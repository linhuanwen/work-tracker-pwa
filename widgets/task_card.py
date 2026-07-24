"""任务卡片组件"""

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import Static, Button, ProgressBar
from textual.message import Message
from textual.css.query import NoMatches

from models.task import Task, calc_subtask_progress, get_progress_color, format_date


class TaskCard(Static):
    """单个任务卡片"""

    class EditRequested(Message):
        """请求编辑任务"""
        def __init__(self, task_id: str):
            super().__init__()
            self.task_id = task_id

    class StatusChanged(Message):
        """任务状态变更"""
        def __init__(self, task_id: str):
            super().__init__()
            self.task_id = task_id

    class DeleteRequested(Message):
        """请求删除任务"""
        def __init__(self, task_id: str):
            super().__init__()
            self.task_id = task_id

    def __init__(self, task: Task, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task

    def compose(self) -> ComposeResult:
        t = self.task

        # 优先级图标
        priority_icons = {'urgent': '🔴', 'important': '🟡', 'normal': '⚪'}
        priority_icon = priority_icons.get(t.priority, '⚪')

        # 状态标签
        status_labels = {
            'todo': '待办',
            'in-progress': '进行中',
            'done': '✓ 完成',
            'cancelled': '已取消',
        }

        # 子任务进度
        progress = calc_subtask_progress(t.subtasks)

        with Horizontal(classes="task-card"):
            # 左侧：优先级图标 + 状态切换按钮
            yield Button(
                priority_icon,
                id=f"toggle-{t.id}",
                classes="task-toggle-btn",
            )

            # 中间：任务信息
            with Vertical(classes="task-info"):
                # 标题行
                with Horizontal(classes="task-title-row"):
                    yield Static(
                        f"[bold]{t.title}[/bold]",
                        classes="task-title",
                    )
                    # 状态标签
                    yield Static(
                        f"[dim]{status_labels.get(t.status, t.status)}[/dim]",
                        classes="task-status-label",
                    )

                # 标签行：分类 + 日期 + 特殊标记
                tags = [f"[italic dim]{t.category}[/italic dim]"]

                if t.deadline:
                    tags.append(f"📅 {format_date(t.deadline)}")
                if t.isLeaderAssigned:
                    source = t.leaderSource or '领导'
                    tags.append(f"👤 {source}")
                if t.isCrossYear:
                    tags.append("🔄 跨年")
                if t.isBlocked:
                    tags.append("🚫 受阻")
                if t.hibernateUntil:
                    tags.append(f"💤 休眠至 {format_date(t.hibernateUntil)}")

                yield Static(" · ".join(tags), classes="task-tags")

                # 子任务进度条
                if progress['total'] > 0:
                    with Horizontal(classes="task-progress-row"):
                        yield Static(
                            f"子任务: {progress['done']}/{progress['total']}",
                            classes="progress-label",
                        )
                        yield ProgressBar(
                            total=progress['total'],
                            progress=progress['done'],
                            classes="task-progress-bar",
                        )

                # 备注预览
                if t.notes:
                    yield Static(
                        f"[dim]{t.notes[:50]}{'...' if len(t.notes) > 50 else ''}[/dim]",
                        classes="task-notes-preview",
                    )

            # 右侧：操作按钮
            with Horizontal(classes="task-actions"):
                yield Button("✎", id=f"edit-{t.id}", classes="task-action-btn")
                yield Button("🗑", id=f"delete-{t.id}", classes="task-action-btn")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id or ""

        if btn_id.startswith("toggle-"):
            self.post_message(self.StatusChanged(self.task.id))
        elif btn_id.startswith("edit-"):
            self.post_message(self.EditRequested(self.task.id))
        elif btn_id.startswith("delete-"):
            self.post_message(self.DeleteRequested(self.task.id))
