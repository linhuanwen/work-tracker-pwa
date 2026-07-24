"""顶层数据模型 —— data.json 的完整结构"""

from typing import Optional
from pydantic import BaseModel, Field
from .task import Task
from .project import Project, AnnualPlan


# ============================================================
# 归档条目
# ============================================================

class WeekSummary(BaseModel):
    """周小结四个模块"""
    doneTasks: str = ''        # markdown
    projectProgress: str = ''  # markdown
    nextWeekPlan: str = ''     # markdown
    blockers: str = ''         # markdown


class WeekEntry(BaseModel):
    """周小结条目"""
    tasks: list[str] = Field(default_factory=list)  # task IDs
    summary: WeekSummary = Field(default_factory=WeekSummary)
    aiPolished: bool = False


class MonthSummary(BaseModel):
    """月小结四个模块"""
    quantitativeSummary: str = ''  # markdown
    projectReview: str = ''        # markdown
    reflection: str = ''           # markdown
    nextMonthFocus: str = ''       # markdown


class MonthEntry(BaseModel):
    """月小结条目"""
    tasks: list[str] = Field(default_factory=list)
    summary: MonthSummary = Field(default_factory=MonthSummary)
    aiPolished: bool = False


class YearSummary(BaseModel):
    """年度报告 - 六大维度"""
    personnelAllocation: str = ''
    internalRecruitment: str = ''
    rewardDiscipline: str = ''
    performance: str = ''
    laborRelations: str = ''
    leaderAssigned: str = ''
    other: str = ''


class YearEntry(BaseModel):
    """年小结条目"""
    tasks: list[str] = Field(default_factory=list)
    summary: YearSummary = Field(default_factory=YearSummary)
    aiPolished: bool = False


class Archive(BaseModel):
    """归档数据"""
    weeks: dict[str, WeekEntry] = Field(default_factory=dict)
    months: dict[str, MonthEntry] = Field(default_factory=dict)
    years: dict[str, YearEntry] = Field(default_factory=dict)


# ============================================================
# 设置 & 顶层数据
# ============================================================

class Settings(BaseModel):
    """应用设置"""
    weeklySummaryDay: int = 5    # 1-7，1=周一
    monthlySummaryDay: int = 28  # 1-28
    aiPolishFlag: bool = False
    categories: list[str] = Field(default_factory=lambda: [
        '人员调配', '内部招聘', '奖惩管理', '绩效管理',
        '劳动关系', '领导交办', '其他',
    ])
    annualPlan: Optional[AnnualPlan] = None


class DataJson(BaseModel):
    """data.json 顶层结构"""
    version: int = 1
    lastModified: str = ''  # ISO8601
    settings: Settings = Field(default_factory=Settings)
    projects: list[Project] = Field(default_factory=list)
    tasks: list[Task] = Field(default_factory=list)
    archives: Archive = Field(default_factory=Archive)


# ============================================================
# 默认数据工厂
# ============================================================

DEFAULT_CATEGORIES = [
    '人员调配', '内部招聘', '奖惩管理', '绩效管理',
    '劳动关系', '领导交办', '其他',
]


def create_default_data() -> DataJson:
    """创建默认数据"""
    from datetime import datetime, timezone
    return DataJson(
        version=1,
        lastModified=datetime.now(timezone.utc).isoformat(),
        settings=Settings(categories=list(DEFAULT_CATEGORIES)),
        projects=[],
        tasks=[],
        archives=Archive(),
    )
