"""项目管理页"""

import time
import random
from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QPushButton, QLabel, QLineEdit, QComboBox, QFrame,
    QProgressBar,
)

from models.project import Project, SubtaskCount
from ui.app import WorkJournalApp


class ProjectsPage(QWidget):
    """项目管理页面"""

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
        title = QLabel("📁 项目管理", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()
        layout.addWidget(header)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content = QWidget()
        self._content_layout = QVBoxLayout(content)
        self._content_layout.setSpacing(8)

        # 项目列表占位
        self._project_list_layout = QVBoxLayout()
        self._content_layout.addLayout(self._project_list_layout)
        self._content_layout.addStretch()

        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

        # 底部快速添加
        add_bar = QWidget()
        add_bar.setStyleSheet("background-color: #ffffff; border-top: 1px solid #e0e0e0; padding: 8px 24px;")
        add_layout = QHBoxLayout(add_bar)
        add_layout.setContentsMargins(0, 0, 0, 0)
        add_layout.setSpacing(8)

        self._title_input = QLineEdit()
        self._title_input.setPlaceholderText("项目名称")
        self._title_input.setMinimumHeight(36)
        self._title_input.returnPressed.connect(self._add_project)
        add_layout.addWidget(self._title_input, 1)

        cats = self._app.settings.categories
        self._cat_combo = QComboBox()
        self._cat_combo.addItems(cats)
        self._cat_combo.setCurrentText(cats[0] if cats else "其他")
        self._cat_combo.setFixedWidth(120)
        add_layout.addWidget(self._cat_combo)

        add_btn = QPushButton("+ 添加")
        add_btn.setProperty("class", "primary-btn")
        add_btn.setMinimumHeight(36)
        add_btn.clicked.connect(self._add_project)
        add_layout.addWidget(add_btn)

        layout.addWidget(add_bar)

    def refresh_data(self) -> None:
        # 清空
        while self._project_list_layout.count():
            item = self._project_list_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        projects = self._app.projects
        if not projects:
            hint = QLabel("暂无项目，使用底部输入栏添加")
            hint.setStyleSheet("color: #999; padding: 16px;")
            self._project_list_layout.addWidget(hint)
            return

        for proj in projects:
            card = self._create_project_card(proj)
            self._project_list_layout.addWidget(card)

    def _create_project_card(self, proj: Project) -> QFrame:
        status_labels = {'in-progress': '进行中', 'completed': '✓ 完成', 'archived': '📦 已归档'}
        status = status_labels.get(proj.status, proj.status)
        task_count = sum(1 for t in self._app.tasks if t.projectId == proj.id)

        card = QFrame()
        card.setProperty("class", "card")
        card.setMinimumHeight(60)

        card_layout = QVBoxLayout(card)
        card_layout.setSpacing(4)

        # 标题行
        title_row = QHBoxLayout()
        title_label = QLabel(proj.title)
        title_label.setStyleSheet("font-size: 14px; font-weight: bold; border: none; background: transparent;")
        title_row.addWidget(title_label)
        title_row.addStretch()

        status_label = QLabel(status)
        status_label.setStyleSheet("font-size: 12px; color: #888; border: none; background: transparent;")
        title_row.addWidget(status_label)
        card_layout.addLayout(title_row)

        # 信息行
        info_row = QHBoxLayout()
        cat_label = QLabel(proj.category)
        cat_label.setStyleSheet(
            "font-size: 11px; padding: 1px 6px; background-color: #e8f0fe; "
            "color: #4a6cf7; border-radius: 3px; border: none;"
        )
        info_row.addWidget(cat_label)

        task_label = QLabel(f"关联 {task_count} 个任务")
        task_label.setStyleSheet("font-size: 12px; color: #888; border: none; background: transparent;")
        info_row.addWidget(task_label)

        # 进度
        if proj.subtaskCount.total > 0:
            pct = int(proj.subtaskCount.done / proj.subtaskCount.total * 100)
            pbar = QProgressBar()
            pbar.setMaximum(100)
            pbar.setValue(pct)
            pbar.setFixedWidth(100)
            pbar.setFixedHeight(6)
            info_row.addWidget(pbar)
            pct_label = QLabel(f"{pct}%")
            pct_label.setStyleSheet("font-size: 11px; color: #888; border: none; background: transparent;")
            info_row.addWidget(pct_label)

        if proj.notes:
            note_label = QLabel(proj.notes[:60])
            note_label.setStyleSheet("font-size: 11px; color: #aaa; border: none; background: transparent;")
            info_row.addWidget(note_label)

        info_row.addStretch()
        card_layout.addLayout(info_row)

        return card

    def _add_project(self) -> None:
        title = self._title_input.text().strip()
        if not title:
            return

        today = datetime.now().strftime('%Y-%m-%d')
        new_proj = Project(
            id=f"p-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=title,
            category=self._cat_combo.currentText(),
            status='in-progress',
            startDate=today,
            targetDate=today,
            notes='',
            subtaskCount=SubtaskCount(total=0, done=0),
        )

        self._app.projects.append(new_proj)
        self._app.mark_dirty()
        self._title_input.clear()
        self.refresh_data()
