#!/usr/bin/env python3
"""生成 demo/data.json 示例数据（日期以「运行当天」为基准）。

示例数据用于：新用户导入后立刻看到完整效果、README 截图取景、文档演示。

用法：
    python scripts/make_demo_data.py           # 写入 demo/data.json
    python scripts/make_demo_data.py --check   # 只校验已有文件是否可解析

生成的内容全部是虚构示例，不含任何真实工作数据。
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "demo" / "data.json"

CATEGORIES = ["日常工作", "项目推进", "协作沟通", "会议培训", "临时交办", "其他"]


def iso(d: date) -> str:
    return d.isoformat()


def week_key(d: date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def month_key(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def task(
    tid: str,
    title: str,
    category: str,
    *,
    created: date,
    status: str = "todo",
    priority: str = "normal",
    completed: date | None = None,
    deadline: date | None = None,
    notes: str = "",
    quantities: list[dict] | None = None,
    subtasks: list[dict] | None = None,
    project_id: str | None = None,
    leader: str | None = None,
    cross_year: bool = False,
    hibernate_until: date | None = None,
    blocked: bool = False,
    start: date | None = None,
) -> dict:
    t: dict = {
        "id": tid,
        "projectId": project_id,
        "title": title,
        "category": category,
        "priority": priority,
        "status": status,
        "createdDate": iso(created),
        "updatedDate": iso(completed or created),
        "deadline": iso(deadline) if deadline else None,
        "startDate": iso(start) if start else None,
        "completedDate": iso(completed) if completed else None,
        "quantities": quantities or [],
        "subtasks": subtasks or [],
        "notes": notes,
        "isLeaderAssigned": leader is not None,
        "isCrossYear": cross_year,
        "isBlocked": blocked,
    }
    if leader:
        t["leaderSource"] = leader
        t["leaderAssignedDate"] = iso(created)
        t["leaderDeadline"] = iso(deadline) if deadline else None
    if hibernate_until:
        t["hibernateUntil"] = iso(hibernate_until)
    return t


def sub(sid: str, title: str, done: bool, completed: date | None = None) -> dict:
    s: dict = {"id": sid, "title": title, "status": "done" if done else "todo"}
    if done and completed:
        s["completedDate"] = iso(completed)
    return s


def build() -> dict:
    # 用本地日期（aware）而非 UTC：示例数据要落在「用户眼里的本周/本月」
    today = datetime.now().astimezone().date()
    this_monday = today - timedelta(days=today.isoweekday() - 1)
    year_start = date(today.year, 1, 3)

    projects = [
        {
            "id": "p-onboarding",
            "title": "新版入职流程落地",
            "category": "项目推进",
            "status": "in-progress",
            "startDate": iso(year_start + timedelta(days=180)),
            "targetDate": iso(this_monday + timedelta(days=45)),
            "notes": "梳理现状 → 出方案 → 试点 → 全量上线",
            "subtaskCount": {"total": 5, "done": 3},
        },
        {
            "id": "p-quarterly",
            "title": "季度数据看板建设",
            "category": "日常工作",
            "status": "in-progress",
            "startDate": iso(year_start + timedelta(days=120)),
            "targetDate": iso(this_monday + timedelta(days=20)),
            "notes": "把每月手工统计改成自动汇总",
            "subtaskCount": {"total": 4, "done": 3},
        },
        {
            "id": "p-archive",
            "title": "年度资料归档专项",
            "category": "其他",
            "status": "completed",
            "startDate": iso(year_start),
            "targetDate": iso(year_start + timedelta(days=150)),
            "notes": "完成纸质与电子档双轨归档",
            "subtaskCount": {"total": 3, "done": 3},
        },
    ]

    tasks: list[dict] = [
        # —— 本周事项（用于周小结演示）——
        task(
            "t-1",
            "新版入职流程方案评审",
            "项目推进",
            created=this_monday - timedelta(days=2),
            status="done",
            priority="urgent",
            completed=this_monday,
            deadline=this_monday,
            notes="评审通过，2 条意见待回填",
            quantities=[{"label": "评审意见", "value": 12, "unit": "条"}],
            project_id="p-onboarding",
        ),
        task(
            "t-2",
            "季度数据看板字段对齐",
            "日常工作",
            created=this_monday - timedelta(days=5),
            status="done",
            priority="important",
            completed=this_monday + timedelta(days=1),
            quantities=[{"label": "对齐字段", "value": 26, "unit": "个"}],
            project_id="p-quarterly",
        ),
        task(
            "t-3",
            "跨部门协调会（试点部门）",
            "协作沟通",
            created=this_monday,
            status="done",
            priority="important",
            completed=this_monday + timedelta(days=2),
            notes="确定试点范围与时间表",
            quantities=[{"label": "参会方", "value": 4, "unit": "个"}],
        ),
        task(
            "t-4",
            "月度例会会议纪要",
            "会议培训",
            created=this_monday,
            status="done",
            completed=this_monday + timedelta(days=2),
            quantities=[{"label": "纪要", "value": 1, "unit": "份"}],
        ),
        task(
            "t-5",
            "临时交办：汇总上半年台账",
            "临时交办",
            created=this_monday + timedelta(days=1),
            status="done",
            priority="urgent",
            completed=this_monday + timedelta(days=3),
            deadline=this_monday + timedelta(days=3),
            leader="分管负责人",
            quantities=[{"label": "汇总条目", "value": 138, "unit": "条"}],
        ),
        # —— 进行中：项目＋子任务（进度条演示）——
        task(
            "t-6",
            "入职流程试点上线",
            "项目推进",
            created=this_monday - timedelta(days=30),
            status="in-progress",
            priority="important",
            start=this_monday - timedelta(days=30),
            deadline=this_monday + timedelta(days=21),
            notes="先跑一个部门，收集反馈再推广",
            project_id="p-onboarding",
            subtasks=[
                sub("s-1", "现状流程梳理", True, this_monday - timedelta(days=21)),
                sub("s-2", "方案初稿", True, this_monday - timedelta(days=14)),
                sub("s-3", "试点范围确认", True, this_monday),
                sub("s-4", "试点培训", False),
                sub("s-5", "反馈收集与修订", False),
            ],
        ),
        task(
            "t-7",
            "看板自动化脚本",
            "日常工作",
            created=this_monday - timedelta(days=45),
            status="in-progress",
            start=this_monday - timedelta(days=45),
            deadline=this_monday + timedelta(days=14),
            notes="每月手工汇总改为一键生成",
            project_id="p-quarterly",
            subtasks=[
                sub("s-6", "字段口径确认", True, this_monday - timedelta(days=30)),
                sub("s-7", "取数逻辑编写", True, this_monday - timedelta(days=10)),
                sub("s-8", "模板排版", True, this_monday + timedelta(days=1)),
                sub("s-9", "试跑与校验", False),
            ],
        ),
        task(
            "t-8",
            "培训材料更新",
            "会议培训",
            created=this_monday - timedelta(days=20),
            status="in-progress",
            start=this_monday - timedelta(days=20),
            subtasks=[
                sub("s-10", "大纲调整", True, this_monday - timedelta(days=7)),
                sub("s-11", "案例补充", False),
            ],
        ),
        task(
            "t-9",
            "与财务核对季度数据",
            "协作沟通",
            created=this_monday - timedelta(days=3),
            status="in-progress",
            priority="important",
            start=this_monday - timedelta(days=3),
            deadline=this_monday + timedelta(days=10),
            blocked=True,
            notes="等对方提供口径说明",
        ),
        # —— 待办 ——
        task(
            "t-10",
            "试点部门培训排期",
            "会议培训",
            created=this_monday,
            status="todo",
            deadline=this_monday + timedelta(days=5),
        ),
        task(
            "t-11",
            "季度总结数据校验",
            "日常工作",
            created=this_monday,
            status="todo",
            deadline=this_monday + timedelta(days=12),
        ),
        task(
            "t-12",
            "年度目标对齐会准备",
            "协作沟通",
            created=this_monday - timedelta(days=1),
            status="todo",
            priority="important",
            deadline=this_monday + timedelta(days=18),
        ),
        task(
            "t-13",
            "跨年：下一年度资料归档计划",
            "其他",
            created=this_monday - timedelta(days=10),
            status="todo",
            deadline=date(today.year + 1, 3, 31),
            cross_year=True,
            hibernate_until=date(today.year + 1, 2, 1),
            notes="跨年任务，临近再提醒",
        ),
        task(
            "t-14",
            "临时交办：明天前提交排查清单",
            "临时交办",
            created=today,
            status="todo",
            priority="urgent",
            deadline=today + timedelta(days=1),
            leader="分管负责人",
            notes="等对方确认排查范围后即可提交",
        ),
    ]

    # —— 历史完成事项：让月度/年度视图有内容 ——
    history: list[tuple[str, str, str, int, int, list[tuple[str, int, str]]]] = [
        ("t-h1", "月度数据汇总", "日常工作", 1, 5, [("汇总报表", 6, "份")]),
        ("t-h2", "流程文档修订", "日常工作", 2, 12, [("修订文档", 4, "份")]),
        ("t-h3", "需求评审会", "项目推进", 2, 20, [("评审需求", 18, "项")]),
        ("t-h4", "跨部门对接", "协作沟通", 3, 8, [("对接事项", 9, "项")]),
        ("t-h5", "季度培训组织", "会议培训", 3, 18, [("参训人员", 46, "人")]),
        ("t-h6", "档案清点", "其他", 4, 10, [("清点档案", 320, "份")]),
        ("t-h7", "年度资料归档", "其他", 5, 15, [("归档卷宗", 96, "卷")]),
        ("t-h8", "半年度总结撰写", "日常工作", 6, 24, [("总结报告", 1, "份")]),
        ("t-h9", "外部对接协调", "协作沟通", 7, 6, [("协调事项", 7, "项")]),
        ("t-h10", "新人带教答疑", "会议培训", 7, 22, [("答疑次数", 14, "次")]),
        ("t-h11", "半年台账整理", "日常工作", 8, 9, [("台账条目", 138, "条")]),
        ("t-h12", "临时交办：专项排查", "临时交办", 8, 19, [("排查对象", 52, "项")]),
    ]
    for tid, title, category, month, day, quants in history:
        try:
            done = date(today.year, month, day)
        except ValueError:  # pragma: no cover - 2 月 29 日等边界
            done = date(today.year, month, 28)
        if done > today:
            continue
        tasks.append(
            task(
                tid,
                title,
                category,
                created=done - timedelta(days=6),
                status="done",
                completed=done,
                quantities=[
                    {"label": label, "value": value, "unit": unit} for label, value, unit in quants
                ],
            )
        )

    wk = week_key(today)
    mk = month_key(today)
    archives = {
        "weeks": {
            wk: {
                "tasks": ["t-1", "t-2", "t-3", "t-4", "t-5"],
                "summary": {
                    "doneTasks": (
                        "【本周完成任务】\n"
                        "- [项目推进] 新版入职流程方案评审：已完成评审意见 12 条。\n"
                        "- [日常工作] 季度数据看板字段对齐：已完成字段 26 个。\n"
                        "- [协作沟通] 跨部门协调会（试点部门）：已完成参会方 4 个。\n"
                        "- [会议培训] 月度例会会议纪要：已完成纪要 1 份。\n"
                        "- [临时交办] 临时交办：汇总上半年台账：已完成汇总条目 138 条。\n\n"
                        "【进行中】\n"
                        "- [项目推进] 入职流程试点上线：已完成现状流程梳理、方案初稿、试点范围确认，"
                        "待开展：试点培训、反馈收集与修订。\n"
                        "- [日常工作] 看板自动化脚本：已完成字段口径确认、取数逻辑编写、模板排版，"
                        "待开展：试跑与校验。"
                    ),
                    "projectProgress": (
                        "新版入职流程落地：进度 40% → 60%，本周完成 1 项子任务（试点范围确认）。\n"
                        "季度数据看板建设：进度 50% → 75%，本周完成 1 项子任务（模板排版）。"
                    ),
                    "nextWeekPlan": (
                        "- 试点部门培训排期\n- 季度总结数据校验\n- 与财务核对季度数据"
                    ),
                    "blockers": "与财务核对季度数据：等待对方提供口径说明。",
                },
                "aiPolished": False,
            }
        },
        "months": {
            mk: {
                "tasks": ["t-1", "t-2", "t-3", "t-4", "t-5", "t-h12"],
                "summary": {
                    "quantitativeSummary": (
                        "| 分类 | 指标 | 数量 |\n"
                        "| --- | --- | --- |\n"
                        "| 日常工作 | 对齐字段 | 26 个 |\n"
                        "| 项目推进 | 评审意见 | 12 条 |\n"
                        "| 协作沟通 | 参会方 | 4 个 |\n"
                        "| 会议培训 | 纪要 | 1 份 |\n"
                        "| 临时交办 | 汇总条目 | 138 条 |\n\n"
                        "本月完成子任务 4 项（跨 3 个任务）"
                    ),
                    "projectReview": (
                        "新版入职流程落地：进度 40% → 60%，本月完成 1 项子任务（试点范围确认）。\n"
                        "看板自动化脚本：进行中，3/4 子步骤已完成（字段口径确认、取数逻辑编写、模板排版）。"
                    ),
                    "reflection": "本月推进节奏正常；跨部门数据口径沟通仍是最耗时环节，下月提前发起。",
                    "nextMonthFocus": "完成试点培训与反馈修订，数据看板试跑上线。",
                },
                "aiPolished": False,
            }
        },
        "years": {
            str(today.year): {
                "tasks": ["t-h1", "t-h2", "t-h3", "t-h7", "t-h8", "t-h11"],
                "summary": {
                    "personnelAllocation": (
                        "月度数据汇总：已完成，汇总报表 6 份。\n"
                        "流程文档修订：已完成，修订文档 4 份。\n"
                        "半年台账整理：已完成，台账条目 138 条。"
                    ),
                    "internalRecruitment": (
                        "需求评审会：已完成，评审需求 18 项。\n"
                        "新版入职流程落地：进行中，3/5 子步骤已完成（现状流程梳理、方案初稿、试点范围确认）。"
                    ),
                    "rewardDiscipline": "跨部门对接：已完成，对接事项 9 项。",
                    "performance": (
                        "季度培训组织：已完成，参训人员 46 人。\n"
                        "新人带教答疑：已完成，答疑次数 14 次。"
                    ),
                    "laborRelations": "外部对接协调：已完成，协调事项 7 项。",
                    "leaderAssigned": "临时交办：专项排查：已完成，排查对象 52 项。",
                    "other": "全年聚焦流程提效，把手工统计逐步替换为自动汇总。",
                },
                "aiPolished": False,
            }
        },
    }

    return {
        "version": 1,
        "revision": 0,
        "lastModified": datetime.now().astimezone().isoformat(),
        "settings": {
            "weeklySummaryDay": 5,
            "monthlySummaryDay": 28,
            "aiPolishFlag": False,
            "categories": CATEGORIES,
        },
        "projects": projects,
        "tasks": tasks,
        "archives": archives,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="生成示例数据 demo/data.json")
    parser.add_argument(
        "--check",
        action="store_true",
        help="只校验已有 demo/data.json 是否为合法 JSON，不重新生成",
    )
    args = parser.parse_args()

    if args.check:
        if not OUT.exists():
            print(f"[!] 缺少 {OUT}", file=sys.stderr)
            return 1
        json.loads(OUT.read_text(encoding="utf-8"))
        print(f"[ok] {OUT} 是合法 JSON")
        return 0

    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[ok] 已写入 {OUT}")
    print(f"     项目 {len(data['projects'])} 个，任务 {len(data['tasks'])} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
