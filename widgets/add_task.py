"""添加任务表单"""

from datetime import date

from textual.app import ComposeResult
from textual.containers import Horizontal
from textual.widgets import (
    Input, Select, Button, Switch,
    Collapsible, Label,
)
from textual.message import Message
from textual.widget import Widget

from models.task import Priority


class AddTaskForm(Widget):
    """新增任务的折叠表单"""

    # 默认展开输入行，折叠高级选项
    DEFAULT_CATEGORIES = [
        '人员调配', '内部招聘', '奖惩管理', '绩效管理',
        '劳动关系', '领导交办', '其他',
    ]

    class TaskAdded(Message):
        """任务添加事件"""
        def __init__(self, title: str, category: str, priority: Priority):
            super().__init__()
            self.title = title
            self.category = category
            self.priority = priority

    def compose(self) -> ComposeResult:
        with Horizontal(id="quick-add-row"):
            yield Input(
                placeholder="输入任务标题，回车添加...",
                id="task-title-input",
            )
            yield Select(
                [(c, c) for c in self.DEFAULT_CATEGORIES],
                value=self.DEFAULT_CATEGORIES[0],
                id="task-category-select",
            )
            yield Select(
                [("紧急", "urgent"), ("重要", "important"), ("普通", "normal")],
                value="normal",
                id="task-priority-select",
            )
            yield Button("➕ 添加", id="btn-add-task", variant="primary")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-add-task":
            self._add_task()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "task-title-input":
            self._add_task()

    def _add_task(self) -> None:
        title_input = self.query_one("#task-title-input", Input)
        category_select = self.query_one("#task-category-select", Select)
        priority_select = self.query_one("#task-priority-select", Select)

        title = title_input.value.strip()
        if not title:
            self.app.notify("请输入任务标题", severity="warning", timeout=2)
            return

        # 清空输入
        title_input.value = ""

        self.post_message(
            self.TaskAdded(
                title=title,
                category=str(category_select.value),
                priority=str(priority_select.value),  # type: ignore
            )
        )
