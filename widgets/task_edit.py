"""任务编辑弹窗（ModalScreen）"""

from datetime import date

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical, Grid
from textual.screen import ModalScreen
from textual.widgets import (
    Static, Input, TextArea, Select, Button,
    Switch, Label,
)
from textual.message import Message

from models.task import Task, Priority, TaskStatus
from models.data import Settings


class TaskEditScreen(ModalScreen[dict | None]):
    """任务编辑弹窗。

    返回 None 表示取消，返回 dict 表示确认（包含变更字段）。
    """

    class Confirmed(Message):
        """确认编辑"""
        def __init__(self, task_id: str, patch: dict):
            super().__init__()
            self.task_id = task_id
            self.patch = patch

    def __init__(self, task: Task, categories: list[str], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task
        self.categories = categories

    def compose(self) -> ComposeResult:
        t = self.task

        with Vertical(classes="modal-container"):
            yield Static(f"编辑任务: {t.title[:30]}", classes="modal-title")

            # 标题
            yield Input(value=t.title, id="edit-title", placeholder="任务标题")

            # 分类 + 优先级
            with Horizontal(classes="edit-row"):
                yield Select(
                    [(c, c) for c in self.categories],
                    value=t.category,
                    id="edit-category",
                    prompt="分类",
                )
                yield Select(
                    [("紧急", "urgent"), ("重要", "important"), ("普通", "normal")],
                    value=t.priority,
                    id="edit-priority",
                    prompt="优先级",
                )

            # 状态
            yield Select(
                [
                    ("待办", "todo"),
                    ("进行中", "in-progress"),
                    ("✓ 完成", "done"),
                    ("已取消", "cancelled"),
                ],
                value=t.status,
                id="edit-status",
                prompt="状态",
            )

            # 截止日期
            yield Input(
                value=t.deadline or "",
                id="edit-deadline",
                placeholder="截止日期 (YYYY-MM-DD)",
            )

            # 备注
            yield TextArea(
                text=t.notes,
                id="edit-notes",
            )

            # 开关项
            with Horizontal(classes="edit-switches"):
                yield Switch(value=t.isLeaderAssigned, id="edit-leader")
                yield Static("领导交办", classes="switch-label")

                yield Switch(value=t.isCrossYear, id="edit-crossyear")
                yield Static("跨年任务", classes="switch-label")

                yield Switch(value=t.isBlocked, id="edit-blocked")
                yield Static("受阻", classes="switch-label")

            # 按钮
            with Horizontal(classes="modal-buttons"):
                yield Button("✓ 保存", id="btn-save", variant="primary")
                yield Button("✗ 取消", id="btn-cancel")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-cancel":
            self.dismiss(None)
        elif event.button.id == "btn-save":
            patch = self._collect_patch()
            self.dismiss(patch)

    def _collect_patch(self) -> dict:
        """收集变更字段"""
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')

        patch: dict = {'updatedDate': today}

        title = self.query_one("#edit-title", Input).value.strip()
        if title and title != self.task.title:
            patch['title'] = title

        category = str(self.query_one("#edit-category", Select).value)
        if category != self.task.category:
            patch['category'] = category

        priority = str(self.query_one("#edit-priority", Select).value)
        if priority != self.task.priority:
            patch['priority'] = priority

        status = str(self.query_one("#edit-status", Select).value)
        if status != self.task.status:
            patch['status'] = status
            if status == 'done':
                patch['completedDate'] = today
            elif self.task.status == 'done':
                patch['completedDate'] = None

        deadline = self.query_one("#edit-deadline", Input).value.strip()
        if deadline != (self.task.deadline or ''):
            patch['deadline'] = deadline if deadline else None

        notes = self.query_one("#edit-notes", TextArea).text
        if notes != self.task.notes:
            patch['notes'] = notes

        is_leader = self.query_one("#edit-leader", Switch).value
        if is_leader != self.task.isLeaderAssigned:
            patch['isLeaderAssigned'] = is_leader

        is_cross = self.query_one("#edit-crossyear", Switch).value
        if is_cross != self.task.isCrossYear:
            patch['isCrossYear'] = is_cross

        is_blocked = self.query_one("#edit-blocked", Switch).value
        if is_blocked != self.task.isBlocked:
            patch['isBlocked'] = is_blocked

        return patch
