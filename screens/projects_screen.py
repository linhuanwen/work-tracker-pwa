"""项目列表屏幕"""

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Input, Select, Footer

from models.data import DataJson
from models.project import Project


class ProjectsScreen(Screen):
    """项目管理"""

    BINDINGS = [
        ("escape", "go_back", "返回"),
        ("n", "new_project", "新建项目"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data

    @property
    def data(self) -> DataJson:
        return self._data

    def compose(self) -> ComposeResult:
        with Horizontal(id="app-header"):
            yield Static("📁 项目", classes="app-title")
            yield Button("← 返回", id="btn-back", classes="hdr-btn")

        with VerticalScroll(id="main-content"):
            yield Static("", id="projects-list")
            # 快速添加
            with Horizontal(id="add-project-row"):
                yield Input(placeholder="项目名称", id="proj-title")
                yield Select(
                    [(c, c) for c in self.data.settings.categories],
                    value=self.data.settings.categories[0] if self.data.settings.categories else '其他',
                    id="proj-category",
                )
                yield Button("+ 添加", id="btn-add-proj", variant="primary")

        yield Footer()

    def on_mount(self) -> None:
        self._render_projects()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button.id
        if btn == "btn-back":
            self.dismiss()
        elif btn == "btn-add-proj":
            self._add_project()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "proj-title":
            self._add_project()

    def _add_project(self) -> None:
        import time, random
        from datetime import datetime

        title_input = self.query_one("#proj-title", Input)
        category_select = self.query_one("#proj-category", Select)

        title = title_input.value.strip()
        if not title:
            self.app.notify("请输入项目名称", severity="warning", timeout=2)
            return

        today = datetime.now().strftime('%Y-%m-%d')
        from models.project import SubtaskCount
        new_proj = Project(
            id=f"p-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=title,
            category=str(category_select.value),
            status='in-progress',
            startDate=today,
            targetDate=today,
            notes='',
            subtaskCount=SubtaskCount(total=0, done=0),
        )

        self.data.projects.append(new_proj)
        title_input.value = ""
        self._mark_changed()
        self._render_projects()
        self.app.notify(f"已添加项目: {title}", timeout=2)

    def _render_projects(self) -> None:
        try:
            display = self.query_one("#projects-list", Static)
        except Exception:
            return

        projects = self.data.projects
        if not projects:
            display.update("[dim]暂无项目\nN: 新建项目 | Esc: 返回[/dim]")
            return

        status_labels = {
            'in-progress': '进行中',
            'completed': '✓ 完成',
            'archived': '📦 已归档',
        }

        lines = []
        for p in projects:
            status = status_labels.get(p.status, p.status)
            # 计算关联任务数
            task_count = sum(1 for t in self.data.tasks if t.projectId == p.id)
            progress = ""
            if p.subtaskCount.total > 0:
                pct = int(p.subtaskCount.done / p.subtaskCount.total * 100)
                progress = f" [{pct}%]"

            lines.append(
                f"[bold]{p.title}[/bold] [{status}] [{p.category}] "
                f"关联 {task_count} 个任务{progress}"
            )
            if p.notes:
                lines.append(f"  [dim]{p.notes[:80]}[/dim]")
            lines.append("")

        lines.append("[dim]N: 新建项目 | Esc: 返回[/dim]")
        display.update("\n".join(lines))

    def action_new_project(self) -> None:
        try:
            self.query_one("#proj-title", Input).focus()
        except Exception:
            pass

    def action_go_back(self) -> None:
        self.dismiss()

    def _mark_changed(self) -> None:
        if hasattr(self.app, '_auto_save') and self.app._auto_save:
            self.app._auto_save.mark_dirty()
