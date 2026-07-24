"""顶部导航栏"""

from textual.app import ComposeResult
from textual.widgets import Header, Button, Static
from textual.containers import Horizontal


class NavBar(Static):
    """自定义导航栏 —— 替代 Header 的 tabs 功能"""

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal(id="nav-tabs"):
            yield Button("📋 任务", id="nav-tasks", variant="primary", classes="nav-btn")
            yield Button("📅 周小结", id="nav-weekly", classes="nav-btn")
            yield Button("📊 月小结", id="nav-monthly", classes="nav-btn")
            yield Button("📈 年度报告", id="nav-yearly", classes="nav-btn")
            yield Button("📁 项目", id="nav-projects", classes="nav-btn")
            yield Button("⚙ 设置", id="nav-settings", classes="nav-btn")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """导航按钮点击 → 向上冒泡给 Screen 处理"""
        event.stop()  # 阻止默认行为，让 Screen 处理路由
        self.post_message(self._nav_event(event.button.id))

    def _nav_event(self, btn_id: str | None):
        """创建导航事件，由 Screen 处理"""
        # 直接触发对应 action
        mapping = {
            "nav-tasks": "navigate('tasks')",
            "nav-weekly": "navigate('weekly')",
            "nav-monthly": "navigate('monthly')",
            "nav-yearly": "navigate('yearly')",
            "nav-projects": "navigate('projects')",
            "nav-settings": "navigate('settings')",
        }
        if btn_id and btn_id in mapping:
            from textual.message import Message
            class NavMessage(Message):
                def __init__(self, target: str):
                    super().__init__()
                    self.target = target
            return NavMessage(mapping[btn_id])
        return None
