"""设置页面"""

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QLabel, QGroupBox, QSpinBox, QCheckBox,
    QListWidget, QPushButton, QLineEdit, QFrame,
)

from ui.app import WorkJournalApp


class SettingsPage(QWidget):
    """应用设置页面"""

    def __init__(self, wj_app: WorkJournalApp):
        super().__init__()
        self._app = wj_app
        self._setup_ui()
        self.refresh_data()

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        header = QWidget(objectName="pageHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 8)
        title = QLabel("⚙ 设置", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        layout.addWidget(header)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(16)
        content_layout.setContentsMargins(0, 8, 0, 16)

        # 小结日设置
        group1 = QGroupBox("小结日设置")
        g1_layout = QVBoxLayout(group1)

        row1 = QHBoxLayout()
        row1.addWidget(QLabel("周小结日（1=周一，7=周日）："))
        self._weekly_day = QSpinBox()
        self._weekly_day.setRange(1, 7)
        self._weekly_day.setValue(5)
        self._weekly_day.valueChanged.connect(self._save_settings)
        row1.addWidget(self._weekly_day)
        row1.addStretch()
        g1_layout.addLayout(row1)

        row2 = QHBoxLayout()
        row2.addWidget(QLabel("月小结日（1-28）："))
        self._monthly_day = QSpinBox()
        self._monthly_day.setRange(1, 28)
        self._monthly_day.setValue(28)
        self._monthly_day.valueChanged.connect(self._save_settings)
        row2.addWidget(self._monthly_day)
        row2.addStretch()
        g1_layout.addLayout(row2)

        content_layout.addWidget(group1)

        # AI 润色
        group2 = QGroupBox("AI 润色")
        g2_layout = QHBoxLayout(group2)
        self._ai_polish = QCheckBox("开启 AI 润色")
        self._ai_polish.toggled.connect(self._save_settings)
        g2_layout.addWidget(self._ai_polish)
        g2_layout.addStretch()
        content_layout.addWidget(group2)

        # 分类管理
        group3 = QGroupBox("分类列表")
        g3_layout = QVBoxLayout(group3)

        self._cat_list = QListWidget()
        g3_layout.addWidget(self._cat_list)

        cat_add_row = QHBoxLayout()
        self._cat_input = QLineEdit()
        self._cat_input.setPlaceholderText("新分类名称")
        self._cat_input.returnPressed.connect(self._add_category)
        cat_add_row.addWidget(self._cat_input)

        add_btn = QPushButton("+ 添加")
        add_btn.setProperty("class", "primary-btn")
        add_btn.clicked.connect(self._add_category)
        cat_add_row.addWidget(add_btn)

        del_btn = QPushButton("- 删除选中")
        del_btn.clicked.connect(self._del_category)
        cat_add_row.addWidget(del_btn)

        g3_layout.addLayout(cat_add_row)
        content_layout.addWidget(group3)

        # 统计信息
        group4 = QGroupBox("统计信息")
        g4_layout = QVBoxLayout(group4)
        self._stats_label = QLabel()
        self._stats_label.setStyleSheet("line-height: 1.8; border: none; background: transparent;")
        g4_layout.addWidget(self._stats_label)
        content_layout.addWidget(group4)

        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

    def refresh_data(self) -> None:
        s = self._app.settings

        self._weekly_day.blockSignals(True)
        self._weekly_day.setValue(s.weeklySummaryDay)
        self._weekly_day.blockSignals(False)

        self._monthly_day.blockSignals(True)
        self._monthly_day.setValue(s.monthlySummaryDay)
        self._monthly_day.blockSignals(False)

        self._ai_polish.blockSignals(True)
        self._ai_polish.setChecked(s.aiPolishFlag)
        self._ai_polish.blockSignals(False)

        # 分类列表
        self._cat_list.clear()
        self._cat_list.addItems(s.categories)

        # 统计
        day_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        weekday = day_names[s.weeklySummaryDay - 1] if 1 <= s.weeklySummaryDay <= 7 else str(s.weeklySummaryDay)
        stats = (
            f"周小结日: {weekday} (第{s.weeklySummaryDay}天)\n"
            f"月小结日: {s.monthlySummaryDay}日\n"
            f"AI 润色: {'开启' if s.aiPolishFlag else '关闭'}\n"
            f"数据文件: {self._app.data_path}\n"
            f"任务总数: {len(self._app.tasks)}\n"
            f"项目总数: {len(self._app.projects)}\n"
            f"周归档: {len(self._app.archives.weeks)} 条\n"
            f"月归档: {len(self._app.archives.months)} 条\n"
            f"年归档: {len(self._app.archives.years)} 条"
        )
        self._stats_label.setText(stats)

    def _save_settings(self) -> None:
        s = self._app.settings
        s.weeklySummaryDay = self._weekly_day.value()
        s.monthlySummaryDay = self._monthly_day.value()
        s.aiPolishFlag = self._ai_polish.isChecked()
        self._app.mark_dirty()
        self.refresh_data()

    def _add_category(self) -> None:
        name = self._cat_input.text().strip()
        if not name:
            return
        if name in self._app.settings.categories:
            return
        self._app.settings.categories.append(name)
        self._app.mark_dirty()
        self._cat_input.clear()
        self.refresh_data()

    def _del_category(self) -> None:
        item = self._cat_list.currentItem()
        if item:
            name = item.text()
            self._app.settings.categories.remove(name)
            self._app.mark_dirty()
            self.refresh_data()
