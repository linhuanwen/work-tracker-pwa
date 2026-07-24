"""年度报告屏幕"""

from datetime import date

from textual.app import ComposeResult
from textual.screen import Screen
from textual.containers import Vertical, VerticalScroll, Horizontal
from textual.widgets import Static, Button, Footer

from models.data import DataJson, YearEntry, YearSummary
from services.reports import (
    YEARLY_DIMENSIONS,
    get_yearly_tasks_by_dimension,
    build_monthly_trend_table,
    build_yearly_quantity_table,
    generate_yearly_one_liner,
    map_category_to_dimension,
)


def dim_to_field(dim: str) -> str:
    """维度名 → YearEntry.summary 字段名"""
    mapping = {
        '人员配置': 'personnelAllocation',
        '内部招聘（晋升晋等）': 'internalRecruitment',
        '奖惩管理': 'rewardDiscipline',
        '绩效管理': 'performance',
        '劳动关系': 'laborRelations',
        '领导交办': 'leaderAssigned',
    }
    return mapping.get(dim, 'other')


class YearlyScreen(Screen):
    """年度报告生成和编辑"""

    BINDINGS = [
        ("escape", "go_back", "返回"),
        ("c", "copy_report", "复制报告"),
    ]

    def __init__(self, app_data: DataJson, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._data = app_data
        self._year = date.today().year

    @property
    def data(self) -> DataJson:
        return self._data

    @property
    def year_key(self) -> str:
        return str(self._year)

    def compose(self) -> ComposeResult:
        with Horizontal(id="app-header"):
            yield Static("📈 年度报告", classes="app-title")
            yield Button("← 返回", id="btn-back", classes="hdr-btn")

        with VerticalScroll(id="main-content"):
            # 年选择器
            with Horizontal(id="year-selector"):
                yield Button("←", id="btn-prev-year")
                yield Static("", id="year-label")
                yield Button("→", id="btn-next-year")

            yield Button("✨ 生成年度报告", id="btn-generate", variant="primary")
            yield Static("", id="report-content")

        yield Footer()

    def on_mount(self) -> None:
        self._update_label()
        self._render_report()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        btn = event.button.id
        if btn == "btn-back":
            self.dismiss()
        elif btn == "btn-prev-year":
            self._year -= 1
            self._update_label()
            self._render_report()
        elif btn == "btn-next-year":
            self._year += 1
            self._update_label()
            self._render_report()
        elif btn == "btn-generate":
            self._generate()

    def _update_label(self) -> None:
        try:
            self.query_one("#year-label", Static).update(
                f"[bold]{self._year}年[/bold]"
            )
        except Exception:
            pass

    def _generate(self) -> None:
        existing = self.data.archives.years.get(self.year_key)
        auto_one_liner = generate_yearly_one_liner(self.data.tasks, self._year)

        # 保留已有 keypoint 文本
        if existing:
            es = existing.summary
            summary = YearSummary(
                personnelAllocation=es.personnelAllocation,
                internalRecruitment=es.internalRecruitment,
                rewardDiscipline=es.rewardDiscipline,
                performance=es.performance,
                laborRelations=es.laborRelations,
                leaderAssigned=es.leaderAssigned,
                other=es.other or auto_one_liner,
            )
        else:
            summary = YearSummary(other=auto_one_liner)

        completed_ids = [
            t.id for t in self.data.tasks
            if t.status == 'done' and t.completedDate
            and t.completedDate[:4] == self.year_key
        ]

        entry = YearEntry(
            tasks=completed_ids,
            summary=summary,
            aiPolished=existing.aiPolished if existing else False,
        )

        self.data.archives.years[self.year_key] = entry
        self._mark_changed()
        self._render_report()
        self.app.notify("已生成年度报告", timeout=2)

    def _render_report(self) -> None:
        try:
            content = self.query_one("#report-content", Static)
        except Exception:
            return

        existing = self.data.archives.years.get(self.year_key)
        if not existing:
            content.update("[dim]点击「✨ 生成年度报告」自动生成报告[/dim]")
            return

        dim_data = get_yearly_tasks_by_dimension(self.data.tasks, self._year)
        monthly_trend = build_monthly_trend_table(
            self.data.tasks, self._year, self.data.settings.categories,
        )
        quantity_table = build_yearly_quantity_table(self.data.tasks, self._year)
        one_liner = existing.summary.other or generate_yearly_one_liner(
            self.data.tasks, self._year,
        )

        lines = []

        # 六维度
        for idx, dim in enumerate(dim_data):
            field = dim_to_field(dim['dimension'])
            keypoint = getattr(existing.summary, field, '') if existing else ''

            if dim['taskCount'] == 0:
                lines.append(f"[dim]{idx+1}. {dim['dimension']}（本年度无完成任务）[/dim]")
            else:
                lines.append(f"[bold reverse]{idx+1}. {dim['dimension']}[/bold reverse]")
                lines.append(f"  全年共 {dim['taskCount']} 项任务")

                if dim['quantities']:
                    parts = [f"{q['label']} {q['value']} {q['unit']}" for q in dim['quantities']]
                    lines.append(f"  量化产出：{'，'.join(parts)}")

                lines.append(f"  任务列表：")
                for title in dim['taskTitles']:
                    lines.append(f"  - {title}")

                if keypoint:
                    lines.append(f"  [italic]关键业绩: {keypoint}[/italic]")
            lines.append("")

        # 附表一：月度趋势
        lines.append("[bold reverse]附表一：月度趋势表[/bold reverse]")
        cats = self.data.settings.categories
        header = "月份 | " + " | ".join(cats) + " | 合计"
        sep = "-" * len(header.replace("|", ""))
        lines.append(header)
        lines.append(sep)
        for row in monthly_trend:
            vals = [str(row['categoryCounts'].get(c, 0)) for c in cats]
            total = row['total']
            lines.append(f"{row['month']} | " + " | ".join(vals) + f" | {total}")
        lines.append("")

        # 附表二：量化总表
        lines.append("[bold reverse]附表二：全年量化产出总表[/bold reverse]")
        if quantity_table:
            lines.append("指标 | 合计 | 单位")
            lines.append("-" * 30)
            for q in quantity_table:
                lines.append(f"{q['label']} | {q['value']} | {q['unit']}")
        else:
            lines.append("（本年度无量化产出记录）")
        lines.append("")

        # 一句话总结
        lines.append(f"[bold reverse]一句话总结[/bold reverse]")
        lines.append(one_liner)
        lines.append("")

        status = "✅ 已润色" if existing.aiPolished else "⏳ 待AI润色"
        lines.append(f"[dim]{status} | C:复制报告 | Esc:返回[/dim]")

        content.update("\n".join(lines))

    def action_copy_report(self) -> None:
        existing = self.data.archives.years.get(self.year_key)
        if not existing:
            self.app.notify("请先生成报告", severity="warning")
            return

        dim_data = get_yearly_tasks_by_dimension(self.data.tasks, self._year)
        text_lines = [
            f"年度报告 {self._year}年",
            "=" * 40,
            "",
        ]

        for idx, dim in enumerate(dim_data):
            text_lines.append(f"{idx+1}. {dim['dimension']}")
            if dim['taskCount'] == 0:
                text_lines.append("（本年度该维度无完成任务）")
            else:
                text_lines.append(f"全年共 {dim['taskCount']} 项任务")
                for title in dim['taskTitles']:
                    text_lines.append(f"  - {title}")
            text_lines.append("")

        text_lines.append(f"一句话总结: {existing.summary.other}")
        text = "\n".join(text_lines)

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
