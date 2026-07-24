"""项目相关数据模型"""

from typing import Literal, Optional
from pydantic import BaseModel, Field

ProjectStatus = Literal['in-progress', 'completed', 'archived']


class SubtaskCount(BaseModel):
    """项目子任务计数"""
    total: int = 0
    done: int = 0


class Project(BaseModel):
    """长期项目"""
    id: str
    title: str
    category: str
    status: ProjectStatus = 'in-progress'
    startDate: str  # ISO date
    targetDate: str  # ISO date
    notes: str = ''
    subtaskCount: SubtaskCount = Field(default_factory=SubtaskCount)


class AnnualPlanSection(BaseModel):
    """年度计划章节"""
    title: str
    source: str
    goals: list[str] = Field(default_factory=list)


class AnnualPlan(BaseModel):
    """年度计划"""
    year: int
    sections: list[AnnualPlanSection] = Field(default_factory=list)
