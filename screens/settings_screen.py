"""设置屏幕"""

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Input, Select, Footer

from models.data import DataJson, DEFAULT_CATEGORIES


class SettingsScreen(Screen):
    """应用设置"""

    BINDINGS = [
        ("escape", "go_back", "返回"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data

    @property
    def data(self) -> DataJson:
        return self._data

    def compose(self) -> ComposeResult:
        with Horizontal(id="app-header"):
            yield Static("⚙ 设置", classes="app-title")
            yield Button("← 返回", id="btn-back", classes="hdr-btn")

        with VerticalScroll(id="main-content"):
            yield Static("", id="settings-content")

        yield Footer()

    def on_mount(self) -> None:
        self._render_settings()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self.dismiss()

    def _render_settings(self) -> None:
        try:
            display = self.query_one("#settings-content", Static)
        except Exception:
            return

        s = self.data.settings
        day_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

        lines = [
            f"[bold]周小结日[/bold]: {day_names[s.weeklySummaryDay - 1] if 1 <= s.weeklySummaryDay <= 7 else s.weeklySummaryDay} (1-7)",
            f"[bold]月小结日[/bold]: {s.monthlySummaryDay}日 (1-28)",
            f"[bold]AI润色[/bold]: {'开启' if s.aiPolishFlag else '关闭'}",
            "",
            "[bold]分类列表[/bold]:",
        ]
        for i, cat in enumerate(s.categories):
            lines.append(f"  {i+1}. {cat}")

        lines += [
            "",
            f"[bold]数据文件[/bold]: {self.app.data_path}",
            f"[bold]任务总数[/bold]: {len(self.data.tasks)}",
            f"[bold]项目总数[/bold]: {len(self.data.projects)}",
            f"[bold]周归档[/bold]: {len(self.data.archives.weeks)} 条",
            f"[bold]月归档[/bold]: {len(self.data.archives.months)} 条",
            f"[bold]年归档[/bold]: {len(self.data.archives.years)} 条",
            "",
            "[dim]Esc: 返回[/dim]",
        ]

        display.update("\n".join(lines))

    def action_go_back(self) -> None:
        self.dismiss()
