"""任务相关数据模型 —— 严格对应 src/types.ts"""

from typing import Literal, Optional
from pydantic import BaseModel, Field

Priority = Literal['urgent', 'important', 'normal']
TaskStatus = Literal['todo', 'in-progress', 'done', 'cancelled']


class Quantity(BaseModel):
    """量化产出指标"""
    label: str = ''
    value: float = 0
    unit: str = ''


class SubTask(BaseModel):
    """子任务"""
    id: str
    title: str
    status: Literal['todo', 'done']


class Task(BaseModel):
    """任务"""
    id: str
    projectId: Optional[str] = None
    title: str
    category: str
    priority: Priority
    status: TaskStatus = 'todo'
    createdDate: str  # ISO date
    updatedDate: str  # ISO date
    deadline: Optional[str] = None  # ISO date
    completedDate: Optional[str] = None  # ISO date
    quantities: list[Quantity] = Field(default_factory=list)
    subtasks: list[SubTask] = Field(default_factory=list)
    notes: str = ''
    isLeaderAssigned: bool = False
    leaderSource: Optional[str] = None
    leaderAssignedDate: Optional[str] = None
    leaderDeadline: Optional[str] = None
    isCrossYear: bool = False
    isBlocked: bool = False
    hibernateUntil: Optional[str] = None


# ============================================================
# 纯函数工具（从 taskUtils.ts 迁移）
# ============================================================

PRIORITY_ORDER: dict[Priority, int] = {
    'urgent': 0,
    'important': 1,
    'normal': 2,
}

URGENT_MAX = 5


def filter_active_tasks(tasks: list[Task]) -> list[Task]:
    """排除 cancelled 状态的任务"""
    return [t for t in tasks if t.status != 'cancelled']


def filter_cancelled_tasks(tasks: list[Task]) -> list[Task]:
    """只保留 cancelled 状态的任务"""
    return [t for t in tasks if t.status == 'cancelled']


def group_tasks_by_priority(tasks: list[Task]) -> dict[str, list[Task]]:
    """按优先级分组"""
    return {
        'urgent': [t for t in tasks if t.priority == 'urgent'],
        'important': [t for t in tasks if t.priority == 'important'],
        'normal': [t for t in tasks if t.priority == 'normal'],
    }


def sort_tasks_by_priority(tasks: list[Task]) -> list[Task]:
    """按优先级排序：urgent > important > normal"""
    return sorted(tasks, key=lambda t: PRIORITY_ORDER[t.priority])


def calc_subtask_progress(subtasks: list[SubTask]) -> dict:
    """计算子任务进度"""
    total = len(subtasks)
    if total == 0:
        return {'total': 0, 'done': 0, 'percent': 0}
    done = sum(1 for s in subtasks if s.status == 'done')
    percent = int(done / total * 100)
    return {'total': total, 'done': done, 'percent': percent}


def get_progress_color(percent: int) -> str:
    """根据进度百分比返回颜色"""
    if percent == 100:
        return '#4caf50'   # 绿色
    if percent >= 67:
        return '#2196f3'   # 蓝色
    if percent >= 34:
        return '#fb8c00'   # 黄色
    return '#e53935'        # 红色


def limit_urgent_tasks(tasks: list[Task]) -> tuple[list[Task], list[str]]:
    """紧急区上限：最多保留 5 条 urgent，超出的降为 important。
    返回 (更新后的任务列表, 被降级的 id 列表)"""
    urgent_active = [
        t for t in tasks
        if t.priority == 'urgent' and t.status != 'cancelled'
    ]
    if len(urgent_active) <= URGENT_MAX:
        return tasks, []

    demoted = urgent_active[URGENT_MAX:]
    demoted_ids = [t.id for t in demoted]
    demoted_set = set(demoted_ids)

    updated = [
        t.model_copy(update={'priority': 'important'})
        if t.id in demoted_set else t
        for t in tasks
    ]
    return updated, demoted_ids


def filter_hibernating_tasks(tasks: list[Task]) -> dict:
    """按休眠状态拆分任务列表"""
    from datetime import date
    today = date.today().isoformat()

    active: list[Task] = []
    hibernating: list[Task] = []

    for task in tasks:
        if (
            task.isCrossYear
            and task.hibernateUntil
            and task.hibernateUntil > today
        ):
            hibernating.append(task)
        else:
            active.append(task)

    return {'active': active, 'hibernating': hibernating}


def format_date(date_str: str | None) -> str:
    """格式化 ISO 日期为 'M月D日'"""
    if not date_str:
        return ''
    parts = date_str.split('-')
    month = int(parts[1])
    day = int(parts[2].split('T')[0] if 'T' in parts[2] else parts[2])
    return f'{month}月{day}日'
