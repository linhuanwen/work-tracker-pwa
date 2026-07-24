"""月小结屏幕"""

from datetime import date

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Footer, Input, TextArea

from models.data import DataJson, MonthEntry, MonthSummary
from services.reports import (
    get_month_key, get_month_label, get_adjacent_month,
    aggregate_monthly_quantities, get_monthly_project_progress,
    get_next_month_focus_candidates,
)


class MonthlyScreen(Screen):
    """月小结生成和编辑"""

    BINDINGS = [
        ("escape", "go_back", "返回"),
        ("c", "copy_report", "复制报告"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data
        today = date.today()
        self._year = today.year
        self._month = today.month

    @property
    def data(self) -> DataJson:
        return self._data

    @property
    def month_key(self) -> str:
        return get_month_key(self._year, self._month)

    def compose(self) -> ComposeResult:
        with Horizontal(id="app-header"):
            yield Static("📊 月小结", classes="app-title")
            yield Button("← 返回", id="btn-back", classes="hdr-btn")

        with VerticalScroll(id="main-content"):
            # 月选择器
            with Horizontal(id="month-selector"):
                yield Button("←", id="btn-prev-month")
                yield Static("", id="month-label")
                yield Button("→", id="btn-next-month")

            yield Button("✨ 生成本月小结", id="btn-generate", variant="primary")
            yield Static("", id="report-content")

            with Horizontal(id="add-plan-row"):
                yield Input(placeholder="+ 添加下月重点任务（回车确认）", id="plan-input")

        yield Footer()

    def on_mount(self) -> None:
        self._update_label()
        self._render_report()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button.id
        if btn == "btn-back":
            self.dismiss()
        elif btn == "btn-prev-month":
            self._year, self._month = get_adjacent_month(self._year, self._month, -1)
            self._update_label()
            self._render_report()
        elif btn == "btn-next-month":
            self._year, self._month = get_adjacent_month(self._year, self._month, 1)
            self._update_label()
            self._render_report()
        elif btn == "btn-generate":
            self._generate()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "plan-input":
            title = event.value.strip()
            if title:
                self._add_focus_task(title)

    def _update_label(self) -> None:
        try:
            self.query_one("#month-label", Static).update(
                f"[bold]{get_month_label(self._year, self._month)}[/bold]"
            )
        except Exception:
            pass

    def _generate(self) -> None:
        existing = self.data.archives.months.get(self.month_key)

        # S1: 量化汇总
        quantities = aggregate_monthly_quantities(self.data.tasks, self._year, self._month)
        if not quantities:
            quant_text = "（本月无量化产出）"
        else:
            lines = ["| 分类 | 指标 | 合计 |", "|------|------|------|"]
            for q in quantities:
                lines.append(f"| {q['category']} | {q['label']} | {q['value']} {q['unit']} |")
            quant_text = "\n".join(lines)

        # S2: 项目进展
        proj = get_monthly_project_progress(
            self.data.tasks, self.data.projects, self._year, self._month,
        )
        if not proj:
            proj_text = "（本月无项目子任务推进）"
        else:
            lines = []
            for p in proj:
                lines.append(
                    f"{p['projectTitle']}  {p['beforePercent']}% → {p['afterPercent']}%，"
                    f"本月完成 {len(p['completedThisWeek'])} 项子任务"
                )
                for sub in p['completedThisWeek']:
                    lines.append(f"  - {sub}")
                lines.append("")
            proj_text = "\n".join(lines).strip()

        # S3: 反思 (保留已有内容)
        reflection_text = existing.summary.reflection if existing else ""

        # S4: 下月重点
        focus = get_next_month_focus_candidates(self.data.tasks, self._year, self._month)
        if not focus:
            focus_text = "（暂无下月到期任务）"
        else:
            focus_text = "\n".join(f"☐ [{f['category']}] {f['title']}" for f in focus)

        # 收集任务 ID
        completed_ids = [
            t.id for t in self.data.tasks
            if t.status == 'done' and t.completedDate
            and t.completedDate[:7] == self.month_key
        ]

        entry = MonthEntry(
            tasks=completed_ids,
            summary=MonthSummary(
                quantitativeSummary=quant_text,
                projectReview=proj_text,
                reflection=reflection_text,
                nextMonthFocus=focus_text,
            ),
            aiPolished=existing.aiPolished if existing else False,
        )

        self.data.archives.months[self.month_key] = entry
        self._mark_changed()
        self._render_report()
        self.app.notify("已生成本月小结", timeout=2)

    def _render_report(self) -> None:
        try:
            content = self.query_one("#report-content", Static)
        except Exception:
            return

        existing = self.data.archives.months.get(self.month_key)
        if not existing:
            content.update("[dim]点击「✨ 生成本月小结」自动生成报告[/dim]")
            return

        s = existing.summary
        status = "✅ 已润色" if existing.aiPolished else "⏳ 待AI润色"
        lines = [
            "[bold reverse]一、量化汇总表[/bold reverse]",
            s.quantitativeSummary,
            "",
            "[bold reverse]二、项目进度回顾[/bold reverse]",
            s.projectReview,
            "",
            "[bold reverse]三、月度反思[/bold reverse]",
            s.reflection or "（待填写）",
            "",
            "[bold reverse]四、下月重点[/bold reverse]",
            s.nextMonthFocus,
            "",
            f"[dim]{status} | C:复制报告 | Esc:返回[/dim]",
        ]
        content.update("\n".join(lines))

    def _add_focus_task(self, title: str) -> None:
        import time, random
        from datetime import datetime
        from models.task import Task

        cat = self.data.settings.categories[-1] if self.data.settings.categories else '其他'
        new_task = Task(
            id=f"t-{int(time.time()*1000):x}-{random.randint(0, 9999)}",
            title=title, category=cat, priority='normal',
            status='todo',
            createdDate=datetime.now().strftime('%Y-%m-%d'),
            updatedDate=datetime.now().strftime('%Y-%m-%d'),
        )
        self.data.tasks.append(new_task)
        self._mark_changed()

        try:
            self.query_one("#plan-input", Input).value = ""
        except Exception:
            pass
        self.app.notify(f"已添加任务: {title[:30]}", timeout=2)

    def action_copy_report(self) -> None:
        existing = self.data.archives.months.get(self.month_key)
        if not existing:
            self.app.notify("请先生成报告", severity="warning")
            return

        s = existing.summary
        text = (
            f"月小结 {get_month_label(self._year, self._month)}\n"
            f"{'='*40}\n\n"
            f"一、量化汇总表\n{s.quantitativeSummary}\n\n"
            f"二、项目进度回顾\n{s.projectReview}\n\n"
            f"三、月度反思\n{s.reflection or '（待填写）'}\n\n"
            f"四、下月重点\n{s.nextMonthFocus}\n"
        )

        import pyperclip
        try:
            pyperclip.copy(text)
            self.app.notify("已复制到剪贴板", timeout=2)
        except Exception:
            self.app.notify("复制失败", severity="error")

    def action_go_back(self) -> None:
        self.dismiss()

    def _mark_changed(self) -> None:
        if hasattr(self.app, '_auto_save') and self.app._auto_save:
            self.app._auto_save.mark_dirty()
