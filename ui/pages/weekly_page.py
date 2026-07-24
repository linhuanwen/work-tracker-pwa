"""周小结页面"""

from datetime import date, datetime

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QPushButton, QLabel, QGroupBox, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QLineEdit, QMessageBox,
)

from models.data import DataJson, WeekEntry, WeekSummary
from models.task import Task
from services.reports import (
    get_week_key, get_week_date_range, get_adjacent_week,
    get_completed_tasks_by_category, get_project_progress_changes,
    get_next_week_plan_candidates, get_coordination_items,
)
from ui.app import WorkJournalApp


class WeeklyPage(QWidget):
    """周小结页面"""

    def __init__(self, wj_app: WorkJournalApp):
        super().__init__()
        self._app = wj_app
        today = date.today()
        self._week_key = get_week_key(today)

        self._setup_ui()
        self.refresh_data()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 顶部
        header = QWidget(objectName="pageHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 8)
        title = QLabel("📅 周小结", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        layout.addWidget(header)

        # 滚动区
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(12)

        # 周选择器
        sel = QHBoxLayout()
        prev_btn = QPushButton("← 上周")
        prev_btn.setProperty("class", "ghost-btn")
        prev_btn.clicked.connect(self._prev_week)
        sel.addWidget(prev_btn)

        self._week_label = QLabel()
        self._week_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._week_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        sel.addWidget(self._week_label, 1)

        next_btn = QPushButton("下周 →")
        next_btn.setProperty("class", "ghost-btn")
        next_btn.clicked.connect(self._next_week)
        sel.addWidget(next_btn)
        content_layout.addLayout(sel)

        # 生成按钮
        gen_btn = QPushButton("✨ 生成本周小结")
        gen_btn.setProperty("class", "primary-btn")
        gen_btn.setMaximumWidth(280)
        gen_btn.clicked.connect(self._generate)
        gen_btn_layout = QHBoxLayout()
        gen_btn_layout.addStretch()
        gen_btn_layout.addWidget(gen_btn)
        gen_btn_layout.addStretch()
        content_layout.addLayout(gen_btn_layout)

        # S1: 本周完成任务
        self._s1_group = QGroupBox("一、本周完成任务")
        self._s1_layout = QVBoxLayout(self._s1_group)
        self._s1_text = QTextEdit()
        self._s1_text.setReadOnly(True)
        self._s1_text.setMaximumHeight(200)
        self._s1_layout.addWidget(self._s1_text)
        content_layout.addWidget(self._s1_group)

        # S2: 项目进度
        self._s2_group = QGroupBox("二、长期项目推进")
        self._s2_layout = QVBoxLayout(self._s2_group)
        self._s2_table = QTableWidget()
        self._s2_table.setMaximumHeight(150)
        self._s2_layout.addWidget(self._s2_table)
        content_layout.addWidget(self._s2_group)

        # S3: 下周计划
        self._s3_group = QGroupBox("三、下周计划")
        self._s3_layout = QVBoxLayout(self._s3_group)
        self._s3_text = QTextEdit()
        self._s3_text.setReadOnly(True)
        self._s3_text.setMaximumHeight(150)
        self._s3_layout.addWidget(self._s3_text)

        plan_row = QHBoxLayout()
        self._plan_input = QLineEdit()
        self._plan_input.setPlaceholderText("+ 添加下周计划任务")
        self._plan_input.returnPressed.connect(self._add_plan_task)
        plan_row.addWidget(self._plan_input)
        add_btn = QPushButton("添加")
        add_btn.setProperty("class", "primary-btn")
        add_btn.clicked.connect(self._add_plan_task)
        plan_row.addWidget(add_btn)
        self._s3_layout.addLayout(plan_row)
        content_layout.addWidget(self._s3_group)

        # S4: 需协调事项
        self._s4_group = QGroupBox("四、需协调事项")
        self._s4_layout = QVBoxLayout(self._s4_group)
        self._s4_text = QTextEdit()
        self._s4_text.setReadOnly(True)
        self._s4_text.setMaximumHeight(150)
        self._s4_layout.addWidget(self._s4_text)
        content_layout.addWidget(self._s4_group)

        # 底部操作
        actions = QHBoxLayout()
        copy_btn = QPushButton("📋 复制报告")
        copy_btn.setProperty("class", "primary-btn")
        copy_btn.clicked.connect(self._copy_report)
        actions.addWidget(copy_btn)
        actions.addStretch()
        content_layout.addLayout(actions)

        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

    def refresh_data(self) -> None:
        self._update_label()
        self._render_existing()

    def _update_label(self) -> None:
        r = get_week_date_range(self._week_key)
        self._week_label.setText(f"{self._week_key}  ({r['label']})")

    def _prev_week(self) -> None:
        self._week_key = get_adjacent_week(self._week_key, -1)
        self.refresh_data()

    def _next_week(self) -> None:
        self._week_key = get_adjacent_week(self._week_key, 1)
        self.refresh_data()

    def _generate(self) -> None:
        existing = self._app.archives.weeks.get(self._week_key)

        # S1
        completed = get_completed_tasks_by_category(
            self._app.tasks, self._week_key, self._app.settings.categories,
        )
        if not completed:
            s1 = "（本周无完成任务）"
        else:
            lines = []
            for group in completed:
                lines.append(f"**{group['category']}**")
                for t in group['tasks']:
                    q = f"（{t['quantityText']}）" if t['quantityText'] else ""
                    lines.append(f"- {t['title']}{q}")
                lines.append("")
            s1 = "\n".join(lines)

        # S2
        proj = get_project_progress_changes(self._app.tasks, self._app.projects, self._week_key)
        if not proj:
            s2 = "（本周无项目子任务推进）"
        else:
            lines = []
            for p in proj:
                lines.append(f"{p['projectTitle']}  {p['beforePercent']}%→{p['afterPercent']}%，"
                           f"完成 {len(p['completedThisWeek'])} 项")
                for sub in p['completedThisWeek']:
                    lines.append(f"  - {sub}")
                lines.append("")
            s2 = "\n".join(lines).strip()

        # S3
        candidates = get_next_week_plan_candidates(self._app.tasks, date.today())
        if existing:
            s3 = existing.summary.nextWeekPlan
        else:
            s3 = "\n".join(f"☐ [{c['category']}] {c['title']}" for c in candidates) if candidates else "（暂无计划）"

        # S4
        coord = get_coordination_items(self._app.tasks, date.today())
        if not coord:
            s4 = "（无需协调事项）"
        else:
            s4 = "\n".join(f"- [{item['reason']}] {item['title']}" for item in coord)

        completed_ids = [t.id for t in self._app.tasks
                        if t.status == 'done' and t.completedDate
                        and is_date_in_week_inline(t.completedDate, self._week_key)]

        entry = WeekEntry(
            tasks=completed_ids,
            summary=WeekSummary(
                doneTasks=s1,
                projectProgress=s2,
                nextWeekPlan=s3,
                blockers=s4,
            ),
            aiPolished=existing.aiPolished if existing else False,
        )

        self._app.archives.weeks[self._week_key] = entry
        self._app.mark_dirty()
        self.refresh_data()

    def _render_existing(self) -> None:
        existing = self._app.archives.weeks.get(self._week_key)
        if not existing:
            self._s1_text.setPlainText("点击「✨ 生成本周小结」自动生成报告")
            self._s2_table.clear()
            self._s2_table.setRowCount(0)
            self._s3_text.setPlainText("")
            self._s4_text.setPlainText("")
            return

        s = existing.summary
        self._s1_text.setMarkdown(s.doneTasks)
        self._s3_text.setPlainText(s.nextWeekPlan)
        self._s4_text.setPlainText(s.blockers)

        # S2 表格
        proj = get_project_progress_changes(self._app.tasks, self._app.projects, self._week_key)
        self._s2_table.setColumnCount(4)
        self._s2_table.setHorizontalHeaderLabels(["项目", "进度变化", "完成子任务", "子任务详情"])
        self._s2_table.setRowCount(len(proj))
        self._s2_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for i, p in enumerate(proj):
            self._s2_table.setItem(i, 0, QTableWidgetItem(p['projectTitle']))
            self._s2_table.setItem(i, 1, QTableWidgetItem(f"{p['beforePercent']}% → {p['afterPercent']}%"))
            self._s2_table.setItem(i, 2, QTableWidgetItem(str(len(p['completedThisWeek']))))
            self._s2_table.setItem(i, 3, QTableWidgetItem("; ".join(p['completedThisWeek'])))

    def _add_plan_task(self) -> None:
        title = self._plan_input.text().strip()
        if not title:
            return
        import time, random
        cat = self._app.settings.categories[-1] if self._app.settings.categories else '其他'
        new_task = Task(
            id=f"t-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=title, category=cat, priority='normal',
            status='todo',
            createdDate=datetime.now().strftime('%Y-%m-%d'),
            updatedDate=datetime.now().strftime('%Y-%m-%d'),
        )
        self._app.tasks.append(new_task)
        self._app.mark_dirty()
        self._plan_input.clear()
        # Refresh S3 section with new plan
        existing = self._app.archives.weeks.get(self._week_key)
        if existing:
            current = existing.summary.nextWeekPlan
            existing.summary.nextWeekPlan = current + f"\n☐ [{cat}] {title}"
            self._app.mark_dirty()
            self.refresh_data()

    def _copy_report(self) -> None:
        existing = self._app.archives.weeks.get(self._week_key)
        if not existing:
            return
        s = existing.summary
        r = get_week_date_range(self._week_key)
        text = (
            f"周小结 {self._week_key} ({r['label']})\n{'='*40}\n\n"
            f"一、本周完成任务\n{s.doneTasks}\n\n"
            f"二、长期项目推进\n{s.projectProgress}\n\n"
            f"三、下周计划\n{s.nextWeekPlan}\n\n"
            f"四、需协调事项\n{s.blockers}\n"
        )
        from PySide6.QtWidgets import QApplication
        QApplication.clipboard().setText(text)
        QMessageBox.information(self, "已复制", "周小结已复制到剪贴板")


def is_date_in_week_inline(date_str: str | None, week_key: str) -> bool:
    """内联版本，避免循环导入"""
    if not date_str:
        return False
    r = get_week_date_range(week_key)
    return r['start'] <= date_str[:10] <= r['end']
