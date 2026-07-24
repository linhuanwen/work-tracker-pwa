"""紧急任务区"""

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Static, Button
from textual.message import Message

from models.task import Task, URGENT_MAX


class UrgentZone(Static):
    """紧急任务区 —— 展示最多 5 条紧急任务"""

    class MoveUp(Message):
        def __init__(self, task_id: str):
            super().__init__()
            self.task_id = task_id

    class MoveDown(Message):
        def __init__(self, task_id: str):
            super().__init__()
            self.task_id = task_id

    def __init__(self, urgent_tasks: list[Task], *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.urgent_tasks = urgent_tasks

    def compose(self) -> ComposeResult:
        with Vertical(classes="urgent-zone"):
            header = f"🔴 紧急任务 ({len(self.urgent_tasks)}/{URGENT_MAX})"
            yield Static(header, classes="section-header urgent-header")

            if not self.urgent_tasks:
                yield Static("  (暂无紧急任务)", classes="empty-hint")
                return

            for i, task in enumerate(self.urgent_tasks):
                with Static(classes="urgent-item"):
                    arrows = ""
                    if i > 0:
                        arrows += "▲ "
                    if i < len(self.urgent_tasks) - 1:
                        arrows += "▼"
                    yield Static(
                        f"  {i+1}. {task.title} [{task.category}] {arrows}",
                        classes="urgent-task",
                    )
