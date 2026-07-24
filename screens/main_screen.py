"""主屏幕 —— 日常任务管理视图"""

from datetime import datetime

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Footer, Collapsible, Input

from models.task import (
    Task,
    filter_active_tasks, filter_cancelled_tasks,
    group_tasks_by_priority, calc_subtask_progress, format_date,
)
from models.data import DataJson

from widgets.add_task import AddTaskForm
from widgets.task_edit import TaskEditScreen


class MainScreen(Screen):
    """主任务管理屏幕"""

    BINDINGS = [
        ("a", "focus_add", "添加任务"),
        ("r", "refresh", "刷新"),
        ("q", "quit", "退出"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data  # 直接引用 App 的 data 对象

    @property
    def data(self) -> DataJson:
        return self._data

    def refresh_data(self, new_data: DataJson) -> None:
        """从外部接收新数据（如 WPS 同步后）"""
        self._data = new_data
        self._render_tasks()

    # ============================================================
    # 布局
    # ============================================================

    def compose(self) -> ComposeResult:
        # 顶部标题栏
        with Horizontal(id="app-header"):
            yield Static("📋 工作清单", classes="app-title")
            with Horizontal(id="header-nav"):
                yield Button("📅 周小结", id="hdr-weekly", classes="hdr-btn")
                yield Button("📊 月小结", id="hdr-monthly", classes="hdr-btn")
                yield Button("📈 年报", id="hdr-yearly", classes="hdr-btn")
                yield Button("📁 项目", id="hdr-projects", classes="hdr-btn")

        # 主内容滚动区
        with VerticalScroll(id="main-content"):
            yield Static("", id="task-display")

        # 底部添加表单
        yield AddTaskForm()

        # 页脚状态
        yield Footer()

    def on_mount(self) -> None:
        self._render_tasks()

    # ============================================================
    # 任务渲染
    # ============================================================

    def _render_tasks(self) -> None:
        """渲染所有任务区域为富文本"""
        try:
            display = self.query_one("#task-display", Static)
        except Exception:
            return

        active = filter_active_tasks(self.data.tasks)
        cancelled = filter_cancelled_tasks(self.data.tasks)
        groups = group_tasks_by_priority(active)

        lines = []

        # --- 紧急区 ---
        urgent = groups['urgent']
        lines.append(f"[bold reverse red] 紧急任务 ({len(urgent)}/5) [/bold reverse red]")
        if urgent:
            for i, t in enumerate(urgent):
                flags = self._task_flags(t)
                title = self._truncate(t.title, 65)
                lines.append(f"  {i+1}. [bold red]●[/bold red] [bold]{title}[/bold]  [dim italic]{t.category}[/dim italic]{flags}")
        else:
            lines.append("  [dim](暂无紧急任务)[/dim]")

        # --- 重要任务 ---
        imp = groups['important']
        lines.append(f"\n[bold reverse yellow] 重要任务 ({len(imp)}) [/bold reverse yellow]")
        lines.extend(self._render_task_items(imp))

        # --- 普通任务 ---
        nor = groups['normal']
        lines.append(f"\n[bold]普通任务 ({len(nor)})[/bold]")
        lines.extend(self._render_task_items(nor))

        # --- 已取消（折叠提示）---
        lines.append(f"\n[dim]已取消: {len(cancelled)} 条[/dim]")

        # --- 底部提示 ---
        lines.append(f"\n[dim]── A:添加  R:刷新  Q:退出 ──[/dim]")

        display.update("\n".join(lines))

    def _render_task_items(self, tasks: list[Task]) -> list[str]:
        """渲染一组任务为文本行"""
        if not tasks:
            return ["  [dim](暂无)[/dim]"]

        status_mark = {
            'todo': '○',
            'in-progress': '[yellow]◉[/yellow]',
            'done': '[green]✓[/green]',
            'cancelled': '[dim]✗[/dim]',
        }

        lines = []
        for t in tasks:
            mark = status_mark.get(t.status, '?')
            progress = calc_subtask_progress(t.subtasks)
            prog_str = ""
            if progress['total'] > 0:
                pct = progress['percent']
                color = 'green' if pct == 100 else 'blue' if pct >= 67 else 'yellow' if pct >= 34 else 'red'
                prog_str = f" [{color}]{progress['done']}/{progress['total']}[/{color}]"

            flags = self._task_flags(t)
            title = self._truncate(t.title, 65)
            lines.append(
                f"  {mark} [bold]{title}[/bold]{prog_str}  [dim italic]{t.category}[/dim italic]{flags}"
            )

        return lines

    def _task_flags(self, t: Task) -> str:
        """任务特殊标记"""
        flags = ""
        if t.isLeaderAssigned:
            flags += " 👤"
        if t.deadline:
            flags += f" 📅{format_date(t.deadline)}"
        if t.isCrossYear:
            flags += " 🔄"
        if t.isBlocked:
            flags += " 🚫"
        if t.notes:
            flags += " 📝"
        return flags

    def _truncate(self, s: str, max_len: int) -> str:
        return s[:max_len] + "…" if len(s) > max_len else s

    # ============================================================
    # 快捷键
    # ============================================================

    def action_focus_add(self) -> None:
        try:
            self.query_one("#task-title-input", Input).focus()
        except Exception:
            pass

    def action_refresh(self) -> None:
        self._render_tasks()

    # ============================================================
    # 导航
    # ============================================================

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn_id = event.button.id or ""
        nav_map = {
            "hdr-weekly": "weekly",
            "hdr-monthly": "monthly",
            "hdr-yearly": "yearly",
            "hdr-projects": "projects",
        }
        target = nav_map.get(btn_id)
        if target:
            self.app.navigate(target)

    # ============================================================
    # 添加任务
    # ============================================================

    def on_add_task_form_task_added(self, message: AddTaskForm.TaskAdded) -> None:
        import time
        import random

        today = datetime.now().strftime('%Y-%m-%d')
        new_task = Task(
            id=f"t-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=message.title,
            category=message.category,
            priority=message.priority,
            status='todo',
            createdDate=today,
            updatedDate=today,
        )

        self.data.tasks.append(new_task)
        self._mark_changed()
        self._render_tasks()
        self.app.notify(f"已添加: {message.title[:30]}", timeout=2)

    # ============================================================
    # 任务编辑弹窗
    # ============================================================

    def _on_task_click(self, task_id: str) -> None:
        """点击任务行 → 弹出编辑 / 状态切换菜单"""
        task = next((t for t in self.data.tasks if t.id == task_id), None)
        if not task:
            return

        self.app.push_screen(
            TaskEditScreen(task, self.data.settings.categories),
            callback=lambda patch: self._on_edit_done(task_id, patch),
        )

    def _on_edit_done(self, task_id: str, patch: dict | None) -> None:
        if patch is None:
            return

        for i, t in enumerate(self.data.tasks):
            if t.id == task_id:
                t_dict = t.model_dump()
                t_dict.update(patch)
                self.data.tasks[i] = Task.model_validate(t_dict)
                break

        self._mark_changed()
        self._render_tasks()

    # ============================================================
    # 键盘交互：选中任务
    # ============================================================

    _selected_idx: int = 0  # 当前选中任务的索引（在 active 列表中）

    def on_key(self, event) -> None:
        """处理上下键移动选中 + 回车编辑"""
        active = filter_active_tasks(self.data.tasks)
        if not active:
            return

        key = event.key
        if key == 'down':
            self._selected_idx = min(self._selected_idx + 1, len(active) - 1)
            self._highlight_selected(active)
        elif key == 'up':
            self._selected_idx = max(self._selected_idx - 1, 0)
            self._highlight_selected(active)
        elif key == 'enter':
            if 0 <= self._selected_idx < len(active):
                self._on_task_click(active[self._selected_idx].id)
        elif key == ' ':
            # 空格切换状态
            if 0 <= self._selected_idx < len(active):
                self._toggle_task_status(active[self._selected_idx].id)
        elif key == 'delete':
            if 0 <= self._selected_idx < len(active):
                task = active[self._selected_idx]
                self.data.tasks = [t for t in self.data.tasks if t.id != task.id]
                self._selected_idx = min(self._selected_idx, len(active) - 2)
                self._mark_changed()
                self._render_tasks()
                self.app.notify(f"已删除: {task.title[:30]}", severity="warning")

    def _highlight_selected(self, active: list[Task]) -> None:
        """重新渲染并高亮当前选中项"""
        self._render_tasks()
        # 简单提示当前选中
        if 0 <= self._selected_idx < len(active):
            t = active[self._selected_idx]
            self.sub_title = f"[选中] {t.title[:40]}"

    def _toggle_task_status(self, task_id: str) -> None:
        """切换任务状态（todo → done → todo）"""
        for t in self.data.tasks:
            if t.id == task_id:
                today = datetime.now().strftime('%Y-%m-%d')
                t_dict = t.model_dump()
                if t.status == 'done':
                    t_dict['status'] = 'todo'
                    t_dict['completedDate'] = None
                elif t.status == 'cancelled':
                    t_dict['status'] = 'todo'
                    t_dict['completedDate'] = None
                else:
                    t_dict['status'] = 'done'
                    t_dict['completedDate'] = today
                t_dict['updatedDate'] = today

                self.data.tasks[self.data.tasks.index(t)] = Task.model_validate(t_dict)
                break

        self._mark_changed()
        self._render_tasks()

    # ============================================================
    # 辅助
    # ============================================================

    def _mark_changed(self) -> None:
        """通知 App 数据已变更，触发自动保存"""
        if hasattr(self.app, '_auto_save') and self.app._auto_save:
            self.app._auto_save.mark_dirty()
