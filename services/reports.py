"""报告生成服务 —— 从 src/*Utils.ts 迁移的纯函数逻辑"""

from datetime import date, timedelta
from models.task import Task
from models.project import Project
from models.data import DataJson


# ============================================================
# 周计算
# ============================================================

def get_week_key(d: date) -> str:
    """ISO week key: '2026-W29'"""
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def get_week_date_range(week_key: str) -> dict:
    """返回 ISO 周的周一至周五日期范围和中文标签"""
    year_str, week_str = week_key.split('-W')
    year = int(year_str)
    week = int(week_str)

    # Jan 4 always in ISO week 1
    jan4 = date(year, 1, 4)
    jan4_iso = jan4.isocalendar()
    # Monday of week 1
    week1_monday = jan4 - timedelta(days=jan4_iso[2] - 1)
    # Monday of target week
    monday = week1_monday + timedelta(weeks=week - 1)
    friday = monday + timedelta(days=4)

    label = f"{monday.month}月{monday.day}日 - {friday.month}月{friday.day}日"
    return {
        'start': monday.isoformat(),
        'end': friday.isoformat(),
        'label': label,
    }


def get_adjacent_week(week_key: str, direction: int) -> str:
    """相邻周，direction: -1 上一周，+1 下一周"""
    r = get_week_date_range(week_key)
    wednesday = date.fromisoformat(r['start']) + timedelta(days=2)
    new_wed = wednesday + timedelta(weeks=direction)
    return get_week_key(new_wed)


def is_date_in_week(date_str: str | None, week_key: str) -> bool:
    if not date_str:
        return False
    r = get_week_date_range(week_key)
    return r['start'] <= date_str[:10] <= r['end']


# ============================================================
# 月计算
# ============================================================

def get_month_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def get_month_label(year: int, month: int) -> str:
    return f"{year}年{month}月"


def get_adjacent_month(year: int, month: int, direction: int) -> tuple[int, int]:
    """返回 (year, month)"""
    new_month = month + direction
    new_year = year
    if new_month < 1:
        new_month = 12
        new_year -= 1
    elif new_month > 12:
        new_month = 1
        new_year += 1
    return new_year, new_month


def is_date_in_month(date_str: str | None, year: int, month: int) -> bool:
    if not date_str:
        return False
    parts = date_str.split('-')
    if len(parts) < 2:
        return False
    return int(parts[0]) == year and int(parts[1]) == month


def is_date_in_year(date_str: str | None, year: int) -> bool:
    if not date_str:
        return False
    return int(date_str[:4]) == year


# ============================================================
# 量化产出格式化
# ============================================================

def format_quantity_text(task: Task) -> str:
    """格式化任务的量化产出为可读文本"""
    if not task.quantities:
        return ''
    return '，'.join(f"{q.label} {q.value} {q.unit}" for q in task.quantities)


# ============================================================
# S1: 本周完成任务（按分类分组）
# ============================================================

def get_completed_tasks_by_category(
    tasks: list[Task],
    week_key: str,
    categories: list[str],
) -> list[dict]:
    """本周完成的任务，按分类分组"""
    completed = [
        t for t in tasks
        if t.status == 'done' and is_date_in_week(t.completedDate, week_key)
    ]

    grouped: dict[str, list[dict]] = {}
    for task in completed:
        grouped.setdefault(task.category, []).append({
            'title': task.title,
            'quantityText': format_quantity_text(task),
        })

    result = []
    for cat in categories:
        if cat in grouped:
            result.append({'category': cat, 'tasks': grouped[cat]})
    return result


# ============================================================
# S2: 项目进度变化
# ============================================================

def get_project_progress_changes(
    tasks: list[Task],
    projects: list[Project],
    week_key: str,
) -> list[dict]:
    """本周有子任务推进的项目进度变化"""
    results = []
    for project in projects:
        p_tasks = [t for t in tasks if t.projectId == project.id and t.status != 'cancelled']
        completed_this_week: list[str] = []
        all_done = 0
        all_total = 0

        for task in p_tasks:
            for sub in task.subtasks:
                all_total += 1
                if sub.status == 'done':
                    all_done += 1
            if task.status == 'done' and is_date_in_week(task.completedDate, week_key):
                for sub in task.subtasks:
                    if sub.status == 'done':
                        completed_this_week.append(sub.title)

        if not completed_this_week:
            continue

        after_pct = int(all_done / all_total * 100) if all_total > 0 else 0
        before_done = all_done - len(completed_this_week)
        before_pct = int(before_done / all_total * 100) if all_total > 0 else 0

        results.append({
            'projectId': project.id,
            'projectTitle': project.title,
            'totalSubtasks': all_total,
            'doneSubtasks': all_done,
            'beforePercent': before_pct,
            'afterPercent': after_pct,
            'completedThisWeek': completed_this_week,
        })
    return results


# ============================================================
# S3: 下周计划候选
# ============================================================

def get_next_week_plan_candidates(tasks: list[Task], ref_date: date) -> list[dict]:
    """查找适合下周计划的任务"""
    ref_iso = ref_date.isoformat()
    max_date = ref_date + timedelta(days=14)
    max_iso = max_date.isoformat()

    candidates = []
    for t in tasks:
        if t.status != 'todo':
            continue
        if not t.deadline:
            candidates.append({'taskId': t.id, 'title': t.title, 'category': t.category})
        elif t.deadline >= ref_iso and t.deadline <= max_iso:
            candidates.append({'taskId': t.id, 'title': t.title, 'category': t.category})
    return candidates


# ============================================================
# S4: 需协调事项
# ============================================================

def get_coordination_items(tasks: list[Task], ref_date: date) -> list[dict]:
    """查找需要协调的任务（阻塞 或 超过7天未更新）"""
    threshold = (ref_date - timedelta(days=7)).isoformat()
    items = []
    seen = set()

    # Pass 1: blocked
    for t in tasks:
        if t.status == 'in-progress' and t.isBlocked:
            items.append({
                'taskId': t.id, 'title': t.title,
                'lastUpdated': t.updatedDate, 'reason': 'blocked',
            })
            seen.add(t.id)

    # Pass 2: stale (>7 days)
    for t in tasks:
        if t.status == 'in-progress' and t.id not in seen and t.updatedDate <= threshold:
            items.append({
                'taskId': t.id, 'title': t.title,
                'lastUpdated': t.updatedDate, 'reason': 'stale',
            })
    return items


# ============================================================
# 月量化汇总
# ============================================================

def aggregate_monthly_quantities(
    tasks: list[Task], year: int, month: int,
) -> list[dict]:
    """汇总指定月份已完成任务的量化产出"""
    completed = [
        t for t in tasks
        if t.status == 'done' and is_date_in_month(t.completedDate, year, month)
    ]
    agg: dict[str, dict] = {}
    for task in completed:
        for q in task.quantities:
            key = f"{task.category}::{q.label}"
            if key in agg:
                agg[key]['value'] += q.value
            else:
                agg[key] = {
                    'category': task.category,
                    'label': q.label,
                    'value': q.value,
                    'unit': q.unit,
                }
    return list(agg.values())


def get_monthly_project_progress(
    tasks: list[Task], projects: list[Project], year: int, month: int,
) -> list[dict]:
    """本月有子任务推进的项目进度变化"""
    results = []
    for project in projects:
        p_tasks = [t for t in tasks if t.projectId == project.id and t.status != 'cancelled']
        completed_this_month: list[str] = []
        all_done = 0
        all_total = 0

        for task in p_tasks:
            for sub in task.subtasks:
                all_total += 1
                if sub.status == 'done':
                    all_done += 1
            if task.status == 'done' and is_date_in_month(task.completedDate, year, month):
                for sub in task.subtasks:
                    if sub.status == 'done':
                        completed_this_month.append(sub.title)

        if not completed_this_month:
            continue

        after_pct = int(all_done / all_total * 100) if all_total > 0 else 0
        before_done = all_done - len(completed_this_month)
        before_pct = int(before_done / all_total * 100) if all_total > 0 else 0

        results.append({
            'projectId': project.id,
            'projectTitle': project.title,
            'beforePercent': before_pct,
            'afterPercent': after_pct,
            'completedThisWeek': completed_this_month,
        })
    return results


def get_next_month_focus_candidates(
    tasks: list[Task], year: int, month: int,
) -> list[dict]:
    """查找下月重点任务候选"""
    ny, nm = get_adjacent_month(year, month, 1)
    import calendar
    last_day = calendar.monthrange(ny, nm)[1]
    nm_start = f"{ny}-{nm:02d}-01"
    nm_end = f"{ny}-{nm:02d}-{last_day:02d}"
    cm_start = f"{year}-{month:02d}-01"

    candidates = []
    for t in tasks:
        if t.status != 'todo':
            continue
        if not t.deadline:
            candidates.append({'taskId': t.id, 'title': t.title, 'category': t.category})
        elif t.deadline >= cm_start and t.deadline >= nm_start and t.deadline <= nm_end:
            candidates.append({'taskId': t.id, 'title': t.title, 'category': t.category})
    return candidates


# ============================================================
# 年报
# ============================================================

YEARLY_DIMENSIONS = [
    '人员配置', '内部招聘（晋升晋等）', '奖惩管理',
    '绩效管理', '劳动关系', '领导交办',
]


def map_category_to_dimension(category: str) -> str:
    mapping = {
        '人员调配': '人员配置',
        '内部招聘': '内部招聘（晋升晋等）',
        '奖惩管理': '奖惩管理',
        '绩效管理': '绩效管理',
        '劳动关系': '劳动关系',
        '领导交办': '领导交办',
    }
    return mapping.get(category, '领导交办')


def get_yearly_tasks_by_dimension(tasks: list[Task], year: int) -> list[dict]:
    """按六维度归纳年度完成任务"""
    year_tasks = [
        t for t in tasks
        if t.status == 'done' and is_date_in_year(t.completedDate, year)
    ]

    dim_map: dict[str, dict] = {}
    for dim in YEARLY_DIMENSIONS:
        dim_map[dim] = {
            'dimension': dim, 'taskCount': 0,
            'taskTitles': [], 'quantities': [],
        }

    for task in year_tasks:
        dim = map_category_to_dimension(task.category)
        entry = dim_map[dim]
        entry['taskCount'] += 1
        entry['taskTitles'].append(task.title)
        for q in task.quantities:
            existing = next((e for e in entry['quantities'] if e['label'] == q.label), None)
            if existing:
                existing['value'] += q.value
            else:
                entry['quantities'].append({'label': q.label, 'value': q.value, 'unit': q.unit})

    return [dim_map[d] for d in YEARLY_DIMENSIONS]


def build_monthly_trend_table(tasks: list[Task], year: int, categories: list[str]) -> list[dict]:
    """构建 12 个月的趋势表"""
    rows = []
    for month in range(1, 13):
        cat_counts = {c: 0 for c in categories}
        for task in tasks:
            if task.status != 'done' or not task.completedDate:
                continue
            parts = task.completedDate.split('-')
            if len(parts) < 2:
                continue
            if int(parts[0]) == year and int(parts[1]) == month:
                cat_counts[task.category] = cat_counts.get(task.category, 0) + 1
        total = sum(cat_counts.values())
        rows.append({'month': f'{month}月', 'categoryCounts': cat_counts, 'total': total})
    return rows


def build_yearly_quantity_table(tasks: list[Task], year: int) -> list[dict]:
    """全年量化产出总表"""
    done_tasks = [
        t for t in tasks
        if t.status == 'done' and is_date_in_year(t.completedDate, year)
    ]
    agg: dict[str, dict] = {}
    for task in done_tasks:
        for q in task.quantities:
            if q.label in agg:
                agg[q.label]['value'] += q.value
            else:
                agg[q.label] = {'label': q.label, 'value': q.value, 'unit': q.unit}
    return list(agg.values())


def generate_yearly_one_liner(tasks: list[Task], year: int) -> str:
    """生成年度一句话总结"""
    done_tasks = [
        t for t in tasks
        if t.status == 'done' and is_date_in_year(t.completedDate, year)
    ]
    if not done_tasks:
        return f'{year}年暂无已完成任务'

    cats = set(t.category for t in done_tasks)
    q_table = build_yearly_quantity_table(tasks, year)
    labels = [q['label'] for q in q_table]

    summary = f'{year}年全年完成 {len(cats)} 类工作共 {len(done_tasks)} 项任务'
    if labels:
        summary += f'，量化产出涵盖{'、'.join(labels)}'
    summary += '。'
    return summary
