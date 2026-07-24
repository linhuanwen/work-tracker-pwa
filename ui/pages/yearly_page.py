"""年度报告页面"""

from datetime import date

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QPushButton, QLabel, QGroupBox, QTextEdit,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QMessageBox,
)

from models.data import YearEntry, YearSummary
from services.reports import (
    YEARLY_DIMENSIONS, get_yearly_tasks_by_dimension,
    build_monthly_trend_table, build_yearly_quantity_table,
    generate_yearly_one_liner,
)
from ui.app import WorkJournalApp


def dim_to_field(dim: str) -> str:
    mapping = {
        '人员配置': 'personnelAllocation',
        '内部招聘（晋升晋等）': 'internalRecruitment',
        '奖惩管理': 'rewardDiscipline',
        '绩效管理': 'performance',
        '劳动关系': 'laborRelations',
        '领导交办': 'leaderAssigned',
    }
    return mapping.get(dim, 'other')


class YearlyPage(QWidget):
    """年度报告页面"""

    def __init__(self, wj_app: WorkJournalApp):
        super().__init__()
        self._app = wj_app
        self._year = date.today().year
        self._dim_editors: dict[str, QTextEdit] = {}
        self._setup_ui()
        self.refresh_data()

    @property
    def year_key(self) -> str:
        return str(self._year)

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        header = QWidget(objectName="pageHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 8)
        title = QLabel("📈 年度报告", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        layout.addWidget(header)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(12)

        # 年选择器
        sel = QHBoxLayout()
        prev_btn = QPushButton("← 上一年")
        prev_btn.setProperty("class", "ghost-btn")
        prev_btn.clicked.connect(lambda: self._change_year(-1))
        sel.addWidget(prev_btn)

        self._year_label = QLabel(f"{self._year}年")
        self._year_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._year_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        sel.addWidget(self._year_label, 1)

        next_btn = QPushButton("下一年 →")
        next_btn.setProperty("class", "ghost-btn")
        next_btn.clicked.connect(lambda: self._change_year(1))
        sel.addWidget(next_btn)
        content_layout.addLayout(sel)

        # 生成按钮
        gen_btn = QPushButton("✨ 生成年度报告")
        gen_btn.setProperty("class", "primary-btn")
        gen_btn.setMaximumWidth(280)
        gen_btn.clicked.connect(self._generate)
        gen_layout = QHBoxLayout()
        gen_layout.addStretch()
        gen_layout.addWidget(gen_btn)
        gen_layout.addStretch()
        content_layout.addLayout(gen_layout)

        # 六大维度
        for dim in YEARLY_DIMENSIONS:
            group = QGroupBox(dim)
            group_layout = QVBoxLayout(group)
            preview = QLabel()
            preview.setWordWrap(True)
            preview.setStyleSheet("color: #555; font-size: 13px; padding: 4px 0; border: none;")
            group_layout.addWidget(preview)
            self._dim_editors[dim] = preview

            keypoint_edit = QTextEdit()
            keypoint_edit.setMaximumHeight(60)
            keypoint_edit.setPlaceholderText("关键业绩提炼（可选）")
            keypoint_edit.textChanged.connect(lambda d=dim, e=keypoint_edit: self._on_keypoint_changed(d, e))
            group_layout.addWidget(keypoint_edit)

            content_layout.addWidget(group)

        # 附表一：月度趋势表
        self._trend_group = QGroupBox("附表一：月度趋势表")
        trend_layout = QVBoxLayout(self._trend_group)
        self._trend_table = QTableWidget()
        trend_layout.addWidget(self._trend_table)
        content_layout.addWidget(self._trend_group)

        # 附表二：量化总表
        self._qty_group = QGroupBox("附表二：全年量化产出总表")
        qty_layout = QVBoxLayout(self._qty_group)
        self._qty_table = QTableWidget()
        qty_layout.addWidget(self._qty_table)
        content_layout.addWidget(self._qty_group)

        # 一句话总结
        self._summary_group = QGroupBox("一句话总结")
        summary_layout = QVBoxLayout(self._summary_group)
        self._summary_label = QLabel()
        self._summary_label.setWordWrap(True)
        self._summary_label.setStyleSheet("font-size: 15px; padding: 8px; background-color: #f0f4ff; border-radius: 6px;")
        summary_layout.addWidget(self._summary_label)
        content_layout.addWidget(self._summary_group)

        # 复制按钮
        copy_btn = QPushButton("📋 复制报告")
        copy_btn.setProperty("class", "primary-btn")
        copy_btn.clicked.connect(self._copy_report)
        content_layout.addWidget(copy_btn)

        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

    def refresh_data(self) -> None:
        self._year_label.setText(f"{self._year}年")
        self._render_existing()

    def _change_year(self, delta: int) -> None:
        self._year += delta
        self.refresh_data()

    def _generate(self) -> None:
        existing = self._app.archives.years.get(self.year_key)
        auto_one_liner = generate_yearly_one_liner(self._app.tasks, self._year)

        if existing:
            es = existing.summary
            summary = YearSummary(
                personnelAllocation=es.personnelAllocation,
                internalRecruitment=es.internalRecruitment,
                rewardDiscipline=es.rewardDiscipline,
                performance=es.performance,
                laborRelations=es.laborRelations,
                leaderAssigned=es.leaderAssigned,
                other=es.other or auto_one_liner,
            )
        else:
            summary = YearSummary(other=auto_one_liner)

        completed_ids = [t.id for t in self._app.tasks
                        if t.status == 'done' and t.completedDate
                        and t.completedDate[:4] == self.year_key]

        entry = YearEntry(
            tasks=completed_ids,
            summary=summary,
            aiPolished=existing.aiPolished if existing else False,
        )
        self._app.archives.years[self.year_key] = entry
        self._app.mark_dirty()
        self.refresh_data()

    def _render_existing(self) -> None:
        existing = self._app.archives.years.get(self.year_key)
        dim_data = get_yearly_tasks_by_dimension(self._app.tasks, self._year)

        for dim_info in dim_data:
            dim = dim_info['dimension']
            editor = self._dim_editors.get(dim)
            if not editor:
                continue

            if dim_info['taskCount'] == 0:
                editor.setText(f"（本年度无完成任务）")
            else:
                lines = [f"全年共 {dim_info['taskCount']} 项任务"]
                if dim_info['quantities']:
                    parts = [f"{q['label']} {q['value']} {q['unit']}" for q in dim_info['quantities']]
                    lines.append(f"量化产出：{'，'.join(parts)}")
                lines.append("任务列表：")
                for title in dim_info['taskTitles']:
                    lines.append(f"  - {title}")
                editor.setText("\n".join(lines))

        # 月度趋势表
        monthly_trend = build_monthly_trend_table(self._app.tasks, self._year, self._app.settings.categories)
        cats = self._app.settings.categories
        self._trend_table.setColumnCount(len(cats) + 2)
        self._trend_table.setHorizontalHeaderLabels(["月份"] + cats + ["合计"])
        self._trend_table.setRowCount(12)
        self._trend_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for i, row in enumerate(monthly_trend):
            self._trend_table.setItem(i, 0, QTableWidgetItem(row['month']))
            for j, cat in enumerate(cats):
                self._trend_table.setItem(i, j + 1, QTableWidgetItem(str(row['categoryCounts'].get(cat, 0))))
            self._trend_table.setItem(i, len(cats) + 1, QTableWidgetItem(str(row['total'])))

        # 量化总表
        qty_table = build_yearly_quantity_table(self._app.tasks, self._year)
        self._qty_table.setColumnCount(3)
        self._qty_table.setHorizontalHeaderLabels(["指标", "合计", "单位"])
        self._qty_table.setRowCount(len(qty_table))
        self._qty_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        for i, q in enumerate(qty_table):
            self._qty_table.setItem(i, 0, QTableWidgetItem(q['label']))
            self._qty_table.setItem(i, 1, QTableWidgetItem(str(q['value'])))
            self._qty_table.setItem(i, 2, QTableWidgetItem(q['unit']))

        # 一句话总结
        one_liner = existing.summary.other if existing else generate_yearly_one_liner(self._app.tasks, self._year)
        self._summary_label.setText(one_liner)

    def _on_keypoint_changed(self, dim: str, editor: QTextEdit) -> None:
        existing = self._app.archives.years.get(self.year_key)
        if existing:
            field = dim_to_field(dim)
            setattr(existing.summary, field, editor.toPlainText())
            self._app.mark_dirty()

    def _copy_report(self) -> None:
        existing = self._app.archives.years.get(self.year_key)
        if not existing:
            return
        dim_data = get_yearly_tasks_by_dimension(self._app.tasks, self._year)
        lines = [f"年度报告 {self._year}年", "=" * 40, ""]
        for idx, dim_info in enumerate(dim_data):
            lines.append(f"{idx + 1}. {dim_info['dimension']}")
            if dim_info['taskCount'] == 0:
                lines.append("（本年度该维度无完成任务）")
            else:
                lines.append(f"全年共 {dim_info['taskCount']} 项任务")
                for title in dim_info['taskTitles']:
                    lines.append(f"  - {title}")
            lines.append("")
        lines.append(f"一句话总结: {existing.summary.other}")
        from PySide6.QtWidgets import QApplication
        QApplication.clipboard().setText("\n".join(lines))
        QMessageBox.information(self, "已复制", "年度报告已复制到剪贴板")
