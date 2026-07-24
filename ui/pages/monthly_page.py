"""月小结页面"""

from datetime import date, datetime

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QPushButton, QLabel, QGroupBox, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QLineEdit, QMessageBox,
)
from PySide6.QtGui import QFont

from models.data import MonthEntry, MonthSummary
from models.task import Task
from services.reports import (
    get_month_key, get_month_label, get_adjacent_month,
    aggregate_monthly_quantities, get_monthly_project_progress,
    get_next_month_focus_candidates,
)
from ui.app import WorkJournalApp


class MonthlyPage(QWidget):
    """月小结页面"""

    def __init__(self, wj_app: WorkJournalApp):
        super().__init__()
        self._app = wj_app
        today = date.today()
        self._year = today.year
        self._month = today.month
        self._setup_ui()
        self.refresh_data()

    @property
    def month_key(self) -> str:
        return get_month_key(self._year, self._month)

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 顶部
        header = QWidget(objectName="pageHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 8)
        title = QLabel("📊 月小结", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        layout.addWidget(header)

        # 滚动区
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(12)

        # 月选择器
        sel = QHBoxLayout()
        prev_btn = QPushButton("← 上月")
        prev_btn.setProperty("class", "ghost-btn")
        prev_btn.clicked.connect(self._prev_month)
        sel.addWidget(prev_btn)

        self._month_label = QLabel()
        self._month_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._month_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        sel.addWidget(self._month_label, 1)

        next_btn = QPushButton("下月 →")
        next_btn.setProperty("class", "ghost-btn")
        next_btn.clicked.connect(self._next_month)
        sel.addWidget(next_btn)
        content_layout.addLayout(sel)

        # 生成按钮
        gen_btn = QPushButton("✨ 生成本月小结")
        gen_btn.setProperty("class", "primary-btn")
        gen_btn.setMaximumWidth(280)
        gen_btn.clicked.connect(self._generate)
        gen_layout = QHBoxLayout()
        gen_layout.addStretch()
        gen_layout.addWidget(gen_btn)
        gen_layout.addStretch()
        content_layout.addLayout(gen_layout)

        # S1: 量化汇总
        self._s1_group = QGroupBox("一、量化汇总表")
        self._s1_layout = QVBoxLayout(self._s1_group)
        self._s1_table = QTableWidget()
        self._s1_table.setMaximumHeight(200)
        self._s1_layout.addWidget(self._s1_table)
        content_layout.addWidget(self._s1_group)

        # S2: 项目进展
        self._s2_group = QGroupBox("二、项目进度回顾")
        self._s2_layout = QVBoxLayout(self._s2_group)
        self._s2_text = QTextEdit()
        self._s2_text.setReadOnly(True)
        self._s2_text.setMaximumHeight(200)
        self._s2_layout.addWidget(self._s2_text)
        content_layout.addWidget(self._s2_group)

        # S3: 反思
        self._s3_group = QGroupBox("三、月度反思")
        self._s3_layout = QVBoxLayout(self._s3_group)
        self._s3_text = QTextEdit()
        self._s3_text.setPlaceholderText("记录本月的工作反思...")
        self._s3_text.textChanged.connect(self._on_reflection_changed)
        self._s3_layout.addWidget(self._s3_text)
        content_layout.addWidget(self._s3_group)

        # S4: 下月重点
        self._s4_group = QGroupBox("四、下月重点")
        self._s4_layout = QVBoxLayout(self._s4_group)
        self._s4_text = QTextEdit()
        self._s4_text.setReadOnly(True)
        self._s4_text.setMaximumHeight(150)
        self._s4_layout.addWidget(self._s4_text)

        plan_row = QHBoxLayout()
        self._plan_input = QLineEdit()
        self._plan_input.setPlaceholderText("+ 添加下月重点任务")
        self._plan_input.returnPressed.connect(self._add_focus_task)
        plan_row.addWidget(self._plan_input)
        add_btn = QPushButton("添加")
        add_btn.setProperty("class", "primary-btn")
        add_btn.clicked.connect(self._add_focus_task)
        plan_row.addWidget(add_btn)
        self._s4_layout.addLayout(plan_row)
        content_layout.addWidget(self._s4_group)

        # 复制按钮
        copy_btn = QPushButton("📋 复制报告")
        copy_btn.setProperty("class", "primary-btn")
        copy_btn.clicked.connect(self._copy_report)
        content_layout.addWidget(copy_btn)

        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

    def refresh_data(self) -> None:
        self._month_label.setText(get_month_label(self._year, self._month))
        self._render_existing()

    def _prev_month(self) -> None:
        self._year, self._month = get_adjacent_month(self._year, self._month, -1)
        self.refresh_data()

    def _next_month(self) -> None:
        self._year, self._month = get_adjacent_month(self._year, self._month, 1)
        self.refresh_data()

    def _generate(self) -> None:
        existing = self._app.archives.months.get(self.month_key)

        # S1
        quantities = aggregate_monthly_quantities(self._app.tasks, self._year, self._month)
        if not quantities:
            s1 = "（本月无量化产出）"
        else:
            lines = ["| 分类 | 指标 | 合计 |", "|------|------|------|"]
            for q in quantities:
                lines.append(f"| {q['category']} | {q['label']} | {q['value']} {q['unit']} |")
            s1 = "\n".join(lines)

        # S2
        proj = get_monthly_project_progress(self._app.tasks, self._app.projects, self._year, self._month)
        if not proj:
            s2 = "（本月无项目子任务推进）"
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
        s3 = existing.summary.reflection if existing else ""

        # S4
        focus = get_next_month_focus_candidates(self._app.tasks, self._year, self._month)
        s4 = "\n".join(f"☐ [{f['category']}] {f['title']}" for f in focus) if focus else "（暂无下月到期任务）"

        completed_ids = [t.id for t in self._app.tasks
                        if t.status == 'done' and t.completedDate
                        and t.completedDate[:7] == self.month_key]

        entry = MonthEntry(
            tasks=completed_ids,
            summary=MonthSummary(
                quantitativeSummary=s1,
                projectReview=s2,
                reflection=s3,
                nextMonthFocus=s4,
            ),
            aiPolished=existing.aiPolished if existing else False,
        )
        self._app.archives.months[self.month_key] = entry
        self._app.mark_dirty()
        self.refresh_data()

    def _render_existing(self) -> None:
        existing = self._app.archives.months.get(self.month_key)
        if not existing:
            self._s1_table.clear()
            self._s1_table.setRowCount(0)
            self._s2_text.setPlainText("点击「✨ 生成本月小结」自动生成报告")
            self._s3_text.setPlainText("")
            self._s4_text.setPlainText("")
            return

        s = existing.summary

        # S1 表格
        quantities = aggregate_monthly_quantities(self._app.tasks, self._year, self._month)
        self._s1_table.setColumnCount(3)
        self._s1_table.setHorizontalHeaderLabels(["分类", "指标", "合计"])
        self._s1_table.setRowCount(len(quantities))
        self._s1_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for i, q in enumerate(quantities):
            self._s1_table.setItem(i, 0, QTableWidgetItem(q['category']))
            self._s1_table.setItem(i, 1, QTableWidgetItem(q['label']))
            self._s1_table.setItem(i, 2, QTableWidgetItem(f"{q['value']} {q['unit']}"))

        self._s2_text.setPlainText(s.projectReview)
        self._s3_text.blockSignals(True)
        self._s3_text.setPlainText(s.reflection)
        self._s3_text.blockSignals(False)
        self._s4_text.setPlainText(s.nextMonthFocus)

    def _on_reflection_changed(self) -> None:
        existing = self._app.archives.months.get(self.month_key)
        if existing:
            existing.summary.reflection = self._s3_text.toPlainText()
            self._app.mark_dirty()

    def _add_focus_task(self) -> None:
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
        existing = self._app.archives.months.get(self.month_key)
        if existing:
            current = existing.summary.nextMonthFocus
            existing.summary.nextMonthFocus = current + f"\n☐ [{cat}] {title}"
            self._app.mark_dirty()
            self.refresh_data()

    def _copy_report(self) -> None:
        existing = self._app.archives.months.get(self.month_key)
        if not existing:
            return
        s = existing.summary
        text = (
            f"月小结 {get_month_label(self._year, self._month)}\n{'='*40}\n\n"
            f"一、量化汇总表\n{s.quantitativeSummary}\n\n"
            f"二、项目进度回顾\n{s.projectReview}\n\n"
            f"三、月度反思\n{s.reflection or '（待填写）'}\n\n"
            f"四、下月重点\n{s.nextMonthFocus}\n"
        )
        from PySide6.QtWidgets import QApplication
        QApplication.clipboard().setText(text)
        QMessageBox.information(self, "已复制", "月小结已复制到剪贴板")
