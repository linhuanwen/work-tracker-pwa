"""紧急任务区 —— 红色边框 + 最多 5 条紧急任务"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGroupBox,
    QPushButton, QLabel, QFrame,
)

from models.task import Task
from ui.widgets.task_card import TaskCard


class UrgentZone(QGroupBox):
    """紧急任务区域，红色主题"""

    task_clicked = Signal(str)
    task_deleted = Signal(str)
    task_status_toggled = Signal(str)
    task_move_up = Signal(str)
    task_move_down = Signal(str)

    MAX_URGENT = 5

    def __init__(self):
        super().__init__("🔴 紧急任务 (0/5)")
        self.setProperty("class", "urgent-group")
        self._tasks: list[Task] = []
        self._layout = QVBoxLayout()
        self._layout.setSpacing(2)
        self.setLayout(self._layout)

    def set_tasks(self, tasks: list[Task]) -> None:
        """设置紧急任务列表"""
        self._tasks = tasks
        self.setTitle(f"🔴 紧急任务 ({len(tasks)}/{self.MAX_URGENT})")

        # 清除旧卡片
        while self._layout.count():
            item = self._layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        if not tasks:
            hint = QLabel("暂无紧急任务")
            hint.setStyleSheet("color: #999; padding: 8px 4px; border: none;")
            self._layout.addWidget(hint)
        else:
            for i, task in enumerate(tasks):
                card = TaskCard(task)
                card.clicked.connect(lambda t=task.id: self.task_clicked.emit(t))
                card.status_toggled.connect(lambda t=task.id: self.task_status_toggled.emit(t))
                card.delete_requested.connect(lambda t=task.id: self.task_deleted.emit(t))

                # 添加上下移动按钮
                row = QHBoxLayout()
                row.setContentsMargins(0, 0, 0, 0)
                row.setSpacing(0)
                row.addWidget(card, 1)

                if len(tasks) > 1:
                    btn_container = QWidget()
                    btn_layout = QVBoxLayout(btn_container)
                    btn_layout.setContentsMargins(4, 0, 0, 0)
                    btn_layout.setSpacing(0)

                    up_btn = QPushButton("▲")
                    up_btn.setFixedSize(24, 20)
                    up_btn.setEnabled(i > 0)
                    up_btn.setStyleSheet("QPushButton { border: none; font-size: 10px; } QPushButton:hover { color: #e53935; }")
                    up_btn.clicked.connect(lambda checked, t=task.id: self.task_move_up.emit(t))
                    btn_layout.addWidget(up_btn)

                    down_btn = QPushButton("▼")
                    down_btn.setFixedSize(24, 20)
                    down_btn.setEnabled(i < len(tasks) - 1)
                    down_btn.setStyleSheet("QPushButton { border: none; font-size: 10px; } QPushButton:hover { color: #e53935; }")
                    down_btn.clicked.connect(lambda checked, t=task.id: self.task_move_down.emit(t))
                    btn_layout.addWidget(down_btn)

                    row.addWidget(btn_container)

                wrapper = QWidget()
                wrapper.setLayout(row)
                self._layout.addWidget(wrapper)

        # 超过上限警告
        if len(tasks) >= self.MAX_URGENT:
            warn = QLabel(f"⚠ 紧急任务已达上限 ({self.MAX_URGENT})，新增紧急任务将自动降为重要")
            warn.setStyleSheet("color: #e53935; font-size: 11px; padding: 4px; border: none;")
            self._layout.addWidget(warn)
