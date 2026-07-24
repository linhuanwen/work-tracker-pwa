"""任务编辑对话框 —— QDialog 模态弹窗，编辑 Task 全部字段"""

from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLineEdit, QTextEdit, QComboBox, QCheckBox,
    QPushButton, QDateEdit, QLabel, QDialogButtonBox,
    QGroupBox, QWidget, QSizePolicy,
)
from PySide6.QtCore import QDate

from models.task import Task, Priority


class TaskEditDialog(QDialog):
    """编辑任务全部字段的模态对话框"""

    PRIORITY_MAP = {"紧急": "urgent", "重要": "important", "普通": "normal"}
    PRIORITY_REV = {"urgent": "紧急", "important": "重要", "normal": "普通"}
    STATUS_MAP = {"待办": "todo", "进行中": "in-progress", "✓ 完成": "done", "已取消": "cancelled"}
    STATUS_REV = {"todo": "待办", "in-progress": "进行中", "done": "✓ 完成", "cancelled": "已取消"}

    def __init__(self, task: Task, categories: list[str], parent=None):
        super().__init__(parent)
        self.task = task
        self.categories = categories
        self._setup_ui()
        self._load_task()

    def _setup_ui(self) -> None:
        self.setWindowTitle("编辑任务")
        self.setMinimumWidth(500)
        self.setMaximumWidth(600)
        self.setModal(True)

        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)

        # 标题
        title_label = QLabel(f"编辑任务: {self.task.title[:30]}")
        title_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        layout.addWidget(title_label)

        # 表单
        form = QFormLayout()
        form.setSpacing(10)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignRight)

        self._title_edit = QLineEdit()
        self._title_edit.setMinimumHeight(32)
        form.addRow("标题:", self._title_edit)

        self._cat_combo = QComboBox()
        self._cat_combo.addItems(self.categories)
        form.addRow("分类:", self._cat_combo)

        self._pri_combo = QComboBox()
        self._pri_combo.addItems(["紧急", "重要", "普通"])
        form.addRow("优先级:", self._pri_combo)

        self._status_combo = QComboBox()
        self._status_combo.addItems(["待办", "进行中", "✓ 完成", "已取消"])
        form.addRow("状态:", self._status_combo)

        self._deadline_edit = QDateEdit()
        self._deadline_edit.setCalendarPopup(True)
        self._deadline_edit.setSpecialValueText("无")
        self._deadline_edit.setDate(QDate.currentDate())
        self._deadline_edit.setMinimumHeight(32)
        form.addRow("截止日期:", self._deadline_edit)

        layout.addLayout(form)

        # 备注
        layout.addWidget(QLabel("备注:"))
        self._notes_edit = QTextEdit()
        self._notes_edit.setMaximumHeight(80)
        self._notes_edit.setPlaceholderText("输入备注...")
        layout.addWidget(self._notes_edit)

        # 开关
        switches = QHBoxLayout()
        self._leader_check = QCheckBox("领导交办")
        self._cross_check = QCheckBox("跨年任务")
        self._blocked_check = QCheckBox("受阻")
        switches.addWidget(self._leader_check)
        switches.addWidget(self._cross_check)
        switches.addWidget(self._blocked_check)
        switches.addStretch()
        layout.addLayout(switches)

        # 按钮
        buttons = QDialogButtonBox()
        save_btn = QPushButton("✓ 保存")
        save_btn.setProperty("class", "primary-btn")
        save_btn.setMinimumHeight(36)
        save_btn.clicked.connect(self.accept)
        buttons.addButton(save_btn, QDialogButtonBox.ButtonRole.AcceptRole)

        cancel_btn = QPushButton("✗ 取消")
        cancel_btn.setProperty("class", "ghost-btn")
        cancel_btn.setMinimumHeight(36)
        cancel_btn.clicked.connect(self.reject)
        buttons.addButton(cancel_btn, QDialogButtonBox.ButtonRole.RejectRole)

        layout.addWidget(buttons)

    def _load_task(self) -> None:
        """加载任务数据到表单"""
        t = self.task
        self._title_edit.setText(t.title)
        self._title_edit.selectAll()

        # 分类
        idx = self._cat_combo.findText(t.category)
        if idx >= 0:
            self._cat_combo.setCurrentIndex(idx)

        # 优先级
        pri_text = self.PRIORITY_REV.get(t.priority, "普通")
        idx = self._pri_combo.findText(pri_text)
        if idx >= 0:
            self._pri_combo.setCurrentIndex(idx)

        # 状态
        status_text = self.STATUS_REV.get(t.status, "待办")
        idx = self._status_combo.findText(status_text)
        if idx >= 0:
            self._status_combo.setCurrentIndex(idx)

        # 截止日期
        if t.deadline:
            try:
                d = QDate.fromString(t.deadline, "yyyy-MM-dd")
                if d.isValid():
                    self._deadline_edit.setDate(d)
            except Exception:
                pass

        # 备注
        self._notes_edit.setPlainText(t.notes)

        # 开关
        self._leader_check.setChecked(t.isLeaderAssigned)
        self._cross_check.setChecked(t.isCrossYear)
        self._blocked_check.setChecked(t.isBlocked)

    def get_patch(self) -> dict | None:
        """获取变更的字段，与原始值相同的不包含在 patch 中"""
        today = datetime.now().strftime('%Y-%m-%d')
        patch: dict = {'updatedDate': today}

        # 标题
        title = self._title_edit.text().strip()
        if title and title != self.task.title:
            patch['title'] = title

        # 分类
        cat = self._cat_combo.currentText()
        if cat != self.task.category:
            patch['category'] = cat

        # 优先级
        pri_text = self._pri_combo.currentText()
        pri = self.PRIORITY_MAP.get(pri_text, 'normal')
        if pri != self.task.priority:
            patch['priority'] = pri

        # 状态
        status_text = self._status_combo.currentText()
        status = self.STATUS_MAP.get(status_text, 'todo')
        if status != self.task.status:
            patch['status'] = status
            if status == 'done':
                patch['completedDate'] = today
            elif self.task.status == 'done':
                patch['completedDate'] = None

        # 截止日期
        dl = self._deadline_edit.date().toString("yyyy-MM-dd")
        if dl != (self.task.deadline or ''):
            patch['deadline'] = dl if dl else None

        # 备注
        notes = self._notes_edit.toPlainText()
        if notes != self.task.notes:
            patch['notes'] = notes

        # 开关
        is_leader = self._leader_check.isChecked()
        if is_leader != self.task.isLeaderAssigned:
            patch['isLeaderAssigned'] = is_leader

        is_cross = self._cross_check.isChecked()
        if is_cross != self.task.isCrossYear:
            patch['isCrossYear'] = is_cross

        is_blocked = self._blocked_check.isChecked()
        if is_blocked != self.task.isBlocked:
            patch['isBlocked'] = is_blocked

        return patch if len(patch) > 1 else None  # > 1 因为有 updatedDate
