"""主任务管理页 —— 紧急区 + 重要/普通任务列表 + 快速添加栏"""

import time
import random
from datetime import datetime

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea,
    QPushButton, QLabel, QGroupBox, QFrame, QLineEdit,
    QComboBox, QMenu,
)

from models.task import (
    Task, Priority, filter_active_tasks, filter_cancelled_tasks,
    group_tasks_by_priority, calc_subtask_progress, format_date,
)
from models.data import DataJson
from ui.app import WorkJournalApp
from ui.widgets.task_card import TaskCard
from ui.widgets.urgent_zone import UrgentZone
from ui.dialogs.task_edit import TaskEditDialog


class TaskPage(QWidget):
    """主任务管理页面"""

    def __init__(self, wj_app: WorkJournalApp):
        super().__init__()
        self._app = wj_app
        self._urgent_zone = None
        self._important_layout = None
        self._normal_layout = None
        self._cancelled_layout = None
        self._cancelled_toggle = None
        self._cancelled_container = None
        self._show_cancelled = False

        self._setup_ui()
        self.refresh_data()

    # ============================================================
    # UI 搭建
    # ============================================================

    def _setup_ui(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 页面标题
        header = QWidget(objectName="pageHeader")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 8)
        title = QLabel("📋 任务清单", objectName="pageTitle")
        header_layout.addWidget(title)
        header_layout.addStretch()

        task_count_label = QLabel()
        task_count_label.setObjectName("taskCountLabel")
        task_count_label.setStyleSheet("color: #999; font-size: 13px;")
        self._task_count_label = task_count_label
        header_layout.addWidget(task_count_label)
        layout.addWidget(header)

        # 滚动区域
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        content = QWidget()
        self._content_layout = QVBoxLayout(content)
        self._content_layout.setContentsMargins(0, 0, 0, 16)
        self._content_layout.setSpacing(0)

        # 紧急任务区
        self._urgent_zone = UrgentZone()
        self._urgent_zone.task_clicked.connect(self._on_task_clicked)
        self._urgent_zone.task_deleted.connect(self._on_task_deleted)
        self._urgent_zone.task_status_toggled.connect(self._on_task_status_toggled)
        self._content_layout.addWidget(self._urgent_zone)

        # 重要任务区
        self._important_section = QGroupBox("🟠 重要任务")
        self._important_layout = QVBoxLayout()
        self._important_layout.setSpacing(2)
        self._important_section.setLayout(self._important_layout)
        self._content_layout.addWidget(self._important_section)

        # 普通任务区
        self._normal_section = QGroupBox("⚪ 普通任务")
        self._normal_layout = QVBoxLayout()
        self._normal_layout.setSpacing(2)
        self._normal_section.setLayout(self._normal_layout)
        self._content_layout.addWidget(self._normal_section)

        # 已取消任务（可折叠）
        self._cancelled_toggle = QPushButton("已取消 (0)")
        self._cancelled_toggle.setProperty("class", "ghost-btn")
        self._cancelled_toggle.setCursor(Qt.CursorShape.PointingHandCursor)
        self._cancelled_toggle.clicked.connect(self._toggle_cancelled)
        self._content_layout.addWidget(self._cancelled_toggle)

        self._cancelled_container = QWidget()
        self._cancelled_layout = QVBoxLayout(self._cancelled_container)
        self._cancelled_layout.setContentsMargins(0, 4, 0, 0)
        self._cancelled_layout.setSpacing(2)
        self._cancelled_container.setVisible(False)
        self._content_layout.addWidget(self._cancelled_container)

        self._content_layout.addStretch()

        scroll.setWidget(content)
        layout.addWidget(scroll, 1)

        # 底部快速添加栏
        add_bar = QWidget(objectName="addTaskBar")
        add_bar.setStyleSheet("""
            #addTaskBar {
                background-color: #ffffff;
                border-top: 1px solid #e0e0e0;
                padding: 8px 24px;
            }
        """)
        add_layout = QHBoxLayout(add_bar)
        add_layout.setContentsMargins(0, 0, 0, 0)
        add_layout.setSpacing(8)

        self._title_input = QLineEdit()
        self._title_input.setPlaceholderText("输入任务标题，回车添加...")
        self._title_input.setMinimumHeight(36)
        self._title_input.returnPressed.connect(self._add_task)
        add_layout.addWidget(self._title_input, 1)

        cats = self._app.settings.categories
        self._cat_combo = QComboBox()
        self._cat_combo.addItems(cats)
        self._cat_combo.setCurrentText(cats[0] if cats else "其他")
        self._cat_combo.setFixedWidth(120)
        add_layout.addWidget(self._cat_combo)

        self._pri_combo = QComboBox()
        self._pri_combo.addItems(["普通", "重要", "紧急"])
        self._pri_combo.setCurrentIndex(0)
        self._pri_combo.setFixedWidth(80)
        # Map display text → Priority value
        self._pri_map = {"紧急": "urgent", "重要": "important", "普通": "normal"}
        add_layout.addWidget(self._pri_combo)

        add_btn = QPushButton("➕ 添加")
        add_btn.setProperty("class", "primary-btn")
        add_btn.setMinimumHeight(36)
        add_btn.clicked.connect(self._add_task)
        add_layout.addWidget(add_btn)

        layout.addWidget(add_bar)

    # ============================================================
    # 数据刷新
    # ============================================================

    def refresh_data(self) -> None:
        """从 App 数据刷新整个页面"""
        data = self._app.data
        active = filter_active_tasks(data.tasks)
        cancelled = filter_cancelled_tasks(data.tasks)
        groups = group_tasks_by_priority(active)

        self._task_count_label.setText(
            f"共 {len(active)} 个活跃任务"
        )

        # 紧急区
        self._urgent_zone.set_tasks(groups['urgent'])

        # 重要区
        self._clear_layout(self._important_layout)
        self._important_section.setTitle(f"🟠 重要任务 ({len(groups['important'])})")
        if groups['important']:
            for task in groups['important']:
                card = self._create_task_card(task)
                self._important_layout.addWidget(card)
        else:
            self._important_layout.addWidget(self._empty_label("暂无重要任务"))

        # 普通区
        self._clear_layout(self._normal_layout)
        self._normal_section.setTitle(f"⚪ 普通任务 ({len(groups['normal'])})")
        if groups['normal']:
            for task in groups['normal']:
                card = self._create_task_card(task)
                self._normal_layout.addWidget(card)
        else:
            self._normal_layout.addWidget(self._empty_label("暂无普通任务"))

        # 已取消区
        self._cancelled_toggle.setText(f"已取消 ({len(cancelled)})")
        self._clear_layout(self._cancelled_layout)
        if self._show_cancelled:
            for task in cancelled:
                card = self._create_task_card(task, is_cancelled=True)
                self._cancelled_layout.addWidget(card)

    def _create_task_card(self, task: Task, is_cancelled: bool = False) -> QWidget:
        """创建任务卡片并连接信号"""
        card = TaskCard(task, is_cancelled=is_cancelled)
        card.clicked.connect(lambda: self._on_task_clicked(task.id))
        card.status_toggled.connect(lambda: self._on_task_status_toggled(task.id))
        card.delete_requested.connect(lambda: self._on_task_deleted(task.id))
        return card

    def _empty_label(self, text: str) -> QLabel:
        label = QLabel(text)
        label.setProperty("class", "hint")
        label.setStyleSheet("padding: 8px 4px;")
        return label

    def _clear_layout(self, layout) -> None:
        """清空布局中的所有控件"""
        if layout is None:
            return
        while layout.count():
            item = layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

    # ============================================================
    # 操作
    # ============================================================

    def _add_task(self) -> None:
        """添加新任务"""
        title = self._title_input.text().strip()
        if not title:
            return

        cat = self._cat_combo.currentText()
        pri_display = self._pri_combo.currentText()
        priority = self._pri_map.get(pri_display, "normal")

        today = datetime.now().strftime('%Y-%m-%d')
        new_task = Task(
            id=f"t-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=title,
            category=cat,
            priority=priority,  # type: ignore
            status='todo',
            createdDate=today,
            updatedDate=today,
        )

        self._app.data.tasks.append(new_task)
        self._app.mark_dirty()
        self._title_input.clear()
        self._title_input.setFocus()
        self.refresh_data()

    def _on_task_clicked(self, task_id: str) -> None:
        """打开任务编辑对话框"""
        task = next((t for t in self._app.data.tasks if t.id == task_id), None)
        if not task:
            return

        dialog = TaskEditDialog(task, self._app.settings.categories, self)
        if dialog.exec():
            patch = dialog.get_patch()
            if patch:
                for i, t in enumerate(self._app.data.tasks):
                    if t.id == task_id:
                        t_dict = t.model_dump()
                        t_dict.update(patch)
                        self._app.data.tasks[i] = Task.model_validate(t_dict)
                        break
                self._app.mark_dirty()
                self.refresh_data()

    def _on_task_status_toggled(self, task_id: str) -> None:
        """切换任务完成状态"""
        for i, t in enumerate(self._app.data.tasks):
            if t.id == task_id:
                today = datetime.now().strftime('%Y-%m-%d')
                t_dict = t.model_dump()
                if t.status == 'done':
                    t_dict['status'] = 'todo'
                    t_dict['completedDate'] = None
                elif t.status == 'cancelled':
                    t_dict['status'] = 'todo'
                    t_dict['completedDate'] = None
                else:
                    t_dict['status'] = 'done'
                    t_dict['completedDate'] = today
                t_dict['updatedDate'] = today
                self._app.data.tasks[i] = Task.model_validate(t_dict)
                break
        self._app.mark_dirty()
        self.refresh_data()

    def _on_task_deleted(self, task_id: str) -> None:
        """删除任务"""
        self._app.data.tasks = [t for t in self._app.data.tasks if t.id != task_id]
        self._app.mark_dirty()
        self.refresh_data()

    def _toggle_cancelled(self) -> None:
        """展开/折叠已取消任务"""
        self._show_cancelled = not self._show_cancelled
        self._cancelled_container.setVisible(self._show_cancelled)
        self.refresh_data()
