"""周小结屏幕"""

from datetime import date

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Footer, Input

from models.data import DataJson, WeekEntry, WeekSummary
from services.reports import (
    get_week_key, get_week_date_range, get_adjacent_week,
    get_completed_tasks_by_category, get_project_progress_changes,
    get_next_week_plan_candidates, get_coordination_items,
)


class WeeklyScreen(Screen):
    """周小结生成和编辑"""

    BINDINGS = [
        ("escape", "go_back", "返回"),
        ("c", "copy_report", "复制报告"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data
        self._week_key = get_week_key(date.today())
        self._plan_input = ""

    @property
    def data(self) -> DataJson:
        return self._data

    # ============================================================
    # 布局
    # ============================================================

    def compose(self) -> ComposeResult:
        with Horizontal(id="app-header"):
            yield Static("📅 周小结", classes="app-title")
            yield Button("← 返回", id="btn-back", classes="hdr-btn")

        with VerticalScroll(id="main-content"):
            # 周选择器
            with Horizontal(id="week-selector"):
                yield Button("←", id="btn-prev-week")
                yield Static("", id="week-label")
                yield Button("→", id="btn-next-week")

            # 生成按钮
            yield Button("✨ 生成本周小结", id="btn-generate", variant="primary")

            # 报告内容区
            yield Static("", id="report-content")

            # 添加计划任务
            with Horizontal(id="add-plan-row"):
                yield Input(placeholder="+ 添加计划任务（回车确认）", id="plan-input")

        yield Footer()

    def on_mount(self) -> None:
        self._update_week_label()
        self._render_report()

    # ============================================================
    # 导航
    # ============================================================

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button.id
        if btn == "btn-back":
            self.dismiss()
        elif btn == "btn-prev-week":
            self._week_key = get_adjacent_week(self._week_key, -1)
            self._update_week_label()
            self._render_report()
        elif btn == "btn-next-week":
            self._week_key = get_adjacent_week(self._week_key, 1)
            self._update_week_label()
            self._render_report()
        elif btn == "btn-generate":
            self._generate()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "plan-input":
            self._add_plan_task(event.value.strip())

    # ============================================================
    # 周标签
    # ============================================================

    def _update_week_label(self) -> None:
        r = get_week_date_range(self._week_key)
        try:
            self.query_one("#week-label", Static).update(
                f"[bold]{self._week_key}[/bold]  {r['label']}"
            )
        except Exception:
            pass

    # ============================================================
    # 生成
    # ============================================================

    def _generate(self) -> None:
        """自动生成周小结并保存"""
        existing = self.data.archives.weeks.get(self._week_key)

        # Section 1: 本周完成
        cat_groups = get_completed_tasks_by_category(
            self.data.tasks, self._week_key, self.data.settings.categories,
        )
        if not cat_groups:
            done_text = "（本周无完成任务）"
        else:
            lines = []
            for g in cat_groups:
                lines.append(f"【{g['category']}】")
                for item in g['tasks']:
                    if item['quantityText']:
                        lines.append(f"- {item['title']}（{item['quantityText']}）")
                    else:
                        lines.append(f"- {item['title']}")
                lines.append("")
            done_text = "\n".join(lines).strip()

        # Section 2: 项目进展
        proj_changes = get_project_progress_changes(
            self.data.tasks, self.data.projects, self._week_key,
        )
        if not proj_changes:
            proj_text = "（本周无项目子任务推进）"
        else:
            lines = []
            for p in proj_changes:
                lines.append(
                    f"{p['projectTitle']}  {p['beforePercent']}% → {p['afterPercent']}%，"
                    f"本周完成 {len(p['completedThisWeek'])} 项子任务"
                )
                for sub in p['completedThisWeek']:
                    lines.append(f"  - {sub}")
                lines.append("")
            proj_text = "\n".join(lines).strip()

        # Section 3: 下周计划
        plan_candidates = get_next_week_plan_candidates(self.data.tasks, date.today())
        if not plan_candidates:
            plan_text = "（暂无待办任务）"
        else:
            plan_text = "\n".join(f"☐ {p['title']}" for p in plan_candidates)

        # Section 4: 需协调
        coord_items = get_coordination_items(self.data.tasks, date.today())
        if not coord_items:
            blockers_text = "（无需协调事项）"
        else:
            lines = []
            for item in coord_items:
                reason_label = "🔴 阻塞" if item['reason'] == 'blocked' else "⚠️ 停滞"
                lines.append(f"- {reason_label} {item['title']}（最后更新：{item['lastUpdated']}）")
            blockers_text = "\n".join(lines)

        # 收集完成的任务 ID
        r = get_week_date_range(self._week_key)
        completed_ids = [
            t.id for t in self.data.tasks
            if t.status == 'done' and t.completedDate
            and r['start'] <= t.completedDate[:10] <= r['end']
        ]

        entry = WeekEntry(
            tasks=completed_ids,
            summary=WeekSummary(
                doneTasks=done_text,
                projectProgress=proj_text,
                nextWeekPlan=plan_text,
                blockers=blockers_text,
            ),
            aiPolished=existing.aiPolished if existing else False,
        )

        self.data.archives.weeks[self._week_key] = entry
        self._mark_changed()
        self._render_report()
        self.app.notify("已生成本周小结", timeout=2)

    # ============================================================
    # 渲染
    # ============================================================

    def _render_report(self) -> None:
        try:
            content = self.query_one("#report-content", Static)
        except Exception:
            return

        existing = self.data.archives.weeks.get(self._week_key)

        if not existing:
            content.update("[dim]点击「✨ 生成本周小结」自动生成报告[/dim]")
            return

        s = existing.summary
        lines = [
            "[bold reverse]一、本周完成任务[/bold reverse]",
            s.doneTasks,
            "",
            "[bold reverse]二、长期项目推进[/bold reverse]",
            s.projectProgress,
            "",
            "[bold reverse]三、下周计划[/bold reverse]",
            s.nextWeekPlan,
            "",
            "[bold reverse]四、需协调事项[/bold reverse]",
            s.blockers,
            "",
        ]

        status = "✅ 已润色" if existing.aiPolished else "⏳ 待AI润色"
        lines.append(f"[dim]{status} | C:复制报告 | Esc:返回[/dim]")

        content.update("\n".join(lines))

    # ============================================================
    # 添加计划任务
    # ============================================================

    def _add_plan_task(self, title: str) -> None:
        if not title:
            return
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

    # ============================================================
    # 复制报告
    # ============================================================

    def action_copy_report(self) -> None:
        existing = self.data.archives.weeks.get(self._week_key)
        if not existing:
            self.app.notify("请先生成报告", severity="warning")
            return

        s = existing.summary
        r = get_week_date_range(self._week_key)
        text = (
            f"周小结 {self._week_key}（{r['label']}）\n"
            f"{'='*40}\n\n"
            f"一、本周完成任务\n{s.doneTasks}\n\n"
            f"二、长期项目推进\n{s.projectProgress}\n\n"
            f"三、下周计划\n{s.nextWeekPlan}\n\n"
            f"四、需协调事项\n{s.blockers}\n"
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
