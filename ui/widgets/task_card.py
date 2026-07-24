"""任务卡片控件 —— 自定义 QFrame，显示任务摘要"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QVBoxLayout, QLabel, QPushButton,
    QProgressBar, QSizePolicy,
)

from models.task import Task, calc_subtask_progress, format_date


class TaskCard(QFrame):
    """任务卡片 —— 显示标题、分类标签、优先级、子任务进度"""

    clicked = Signal()
    status_toggled = Signal()
    delete_requested = Signal()

    STATUS_DOT = {
        'todo':        ('○', '#999'),
        'in-progress': ('◉', '#2196f3'),
        'done':        ('✓', '#4caf50'),
        'cancelled':   ('✗', '#bbb'),
    }

    PRIORITY_BORDER = {
        'urgent':    '#e53935',
        'important': '#fb8c00',
        'normal':    '#d0d5dd',
    }

    def __init__(self, task: Task, is_cancelled: bool = False):
        super().__init__()
        self.task = task
        self._is_cancelled = is_cancelled
        self._setup_ui()
        self._apply_style()

    def _setup_ui(self) -> None:
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(44)

        root = QHBoxLayout(self)
        root.setContentsMargins(12, 8, 12, 8)
        root.setSpacing(10)

        # 左侧颜色条
        bar = QFrame()
        bar.setFixedWidth(4)
        bar_color = self.PRIORITY_BORDER.get(self.task.priority, '#d0d5dd')
        if self._is_cancelled:
            bar_color = '#ddd'
        bar.setStyleSheet(f"background-color: {bar_color}; border-radius: 2px; border: none;")
        root.addWidget(bar)

        # 状态图标
        dot_text, dot_color = self.STATUS_DOT.get(self.task.status, ('○', '#999'))
        dot = QLabel(dot_text)
        dot.setStyleSheet(f"color: {dot_color}; font-size: 18px; font-weight: bold; border: none; background: transparent;")
        dot.setFixedWidth(24)
        dot.setAlignment(Qt.AlignmentFlag.AlignCenter)
        root.addWidget(dot)

        # 中间内容
        content = QVBoxLayout()
        content.setSpacing(4)

        # 标题行
        title_row = QHBoxLayout()
        title_row.setSpacing(6)

        title = QLabel(self.task.title)
        title.setStyleSheet("font-size: 14px; font-weight: bold; border: none; background: transparent;")
        if self.task.status == 'done':
            title.setStyleSheet(
                "font-size: 14px; font-weight: bold; color: #999; "
                "text-decoration: line-through; border: none; background: transparent;"
            )
        elif self._is_cancelled:
            title.setStyleSheet(
                "font-size: 14px; color: #bbb; font-style: italic; border: none; background: transparent;"
            )
        title_row.addWidget(title)

        # 标签
        cat_tag = QLabel(self.task.category)
        cat_tag.setStyleSheet(
            "font-size: 11px; padding: 1px 6px; background-color: #e8f0fe; "
            "color: #4a6cf7; border-radius: 3px; border: none; font-weight: bold;"
        )
        title_row.addWidget(cat_tag)

        if self.task.isLeaderAssigned:
            leader_tag = QLabel("👤 领导交办")
            leader_tag.setStyleSheet(
                "font-size: 11px; padding: 1px 6px; background-color: #ffebee; "
                "color: #e53935; border-radius: 3px; border: none;"
            )
            title_row.addWidget(leader_tag)

        title_row.addStretch()
        content.addLayout(title_row)

        # 信息行
        info_row = QHBoxLayout()
        info_row.setSpacing(12)

        if self.task.deadline:
            dl = QLabel(f"📅 {format_date(self.task.deadline)}")
            dl.setStyleSheet("font-size: 12px; color: #888; border: none; background: transparent;")
            info_row.addWidget(dl)

        # 子任务进度
        progress = calc_subtask_progress(self.task.subtasks)
        if progress['total'] > 0:
            pct = progress['percent']
            color = '#4caf50' if pct == 100 else '#2196f3' if pct >= 67 else '#fb8c00' if pct >= 34 else '#e53935'
            sub_label = QLabel(f"子任务: {progress['done']}/{progress['total']}")
            sub_label.setStyleSheet(f"font-size: 11px; color: {color}; border: none; background: transparent;")
            info_row.addWidget(sub_label)

            # 迷你进度条
            pbar = QProgressBar()
            pbar.setMaximum(100)
            pbar.setValue(pct)
            pbar.setFixedWidth(60)
            pbar.setFixedHeight(6)
            pbar.setStyleSheet(f"""
                QProgressBar {{ border: none; background-color: #f0f0f0; border-radius: 3px; }}
                QProgressBar::chunk {{ background-color: {color}; border-radius: 3px; }}
            """)
            info_row.addWidget(pbar)

        if self.task.isCrossYear:
            cross = QLabel("🔄 跨年")
            cross.setStyleSheet("font-size: 11px; color: #888; border: none; background: transparent;")
            info_row.addWidget(cross)

        if self.task.isBlocked:
            blocked = QLabel("🚫 受阻")
            blocked.setStyleSheet("font-size: 11px; color: #e53935; border: none; background: transparent;")
            info_row.addWidget(blocked)

        if self.task.notes:
            note_preview = self.task.notes[:40] + ("..." if len(self.task.notes) > 40 else "")
            note_label = QLabel(f"📝 {note_preview}")
            note_label.setStyleSheet("font-size: 11px; color: #aaa; border: none; background: transparent;")
            info_row.addWidget(note_label)

        info_row.addStretch()
        content.addLayout(info_row)

        root.addLayout(content, 1)

        # 右侧操作按钮
        actions = QVBoxLayout()
        actions.setSpacing(2)

        # 完成按钮
        if self.task.status != 'cancelled':
            done_btn = QPushButton("✓" if self.task.status != 'done' else "↩")
            done_btn.setFixedSize(28, 28)
            done_btn.setProperty("class", "icon-btn")
            done_btn.setToolTip("标记完成" if self.task.status != 'done' else "取消完成")
            done_btn.clicked.connect(self.status_toggled.emit)
            done_btn.setStyleSheet("""
                QPushButton { border: none; background: transparent; font-size: 14px; border-radius: 4px; }
                QPushButton:hover { background-color: #e8f5e9; color: #4caf50; }
            """)
            actions.addWidget(done_btn)

        # 删除按钮
        del_btn = QPushButton("🗑")
        del_btn.setFixedSize(28, 28)
        del_btn.setProperty("class", "icon-btn")
        del_btn.setToolTip("删除")
        del_btn.clicked.connect(self.delete_requested.emit)
        del_btn.setStyleSheet("""
            QPushButton { border: none; background: transparent; font-size: 12px; border-radius: 4px; }
            QPushButton:hover { background-color: #ffebee; color: #e53935; }
        """)
        actions.addWidget(del_btn)

        root.addLayout(actions)

    def _apply_style(self) -> None:
        """应用卡片样式"""
        if self._is_cancelled:
            bg = "#fafafa"
            border = "1px solid #eee"
        elif self.task.priority == 'urgent':
            bg = "#fff5f5"
            border = f"1px solid #e8e8e8; border-left: 4px solid #e53935;"
        elif self.task.priority == 'important':
            bg = "#ffffff"
            border = f"1px solid #e8e8e8; border-left: 3px solid #fb8c00;"
        else:
            bg = "#ffffff"
            border = "1px solid #e8e8e8;"

        self.setStyleSheet(f"""
            TaskCard {{
                background-color: {bg};
                border: {border};
                border-radius: 6px;
            }}
            TaskCard:hover {{
                background-color: #fafbfc;
                border-color: #d0d5dd;
            }}
        """)

    def mousePressEvent(self, event) -> None:
        """单击打开编辑"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit()
        super().mousePressEvent(event)
