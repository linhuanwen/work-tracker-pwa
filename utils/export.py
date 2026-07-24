"""CSV 导出工具"""

import csv
import io
from pathlib import Path
from models.task import Task


def export_tasks_csv(tasks: list[Task], output_path: str | Path) -> str:
    """将任务列表导出为 CSV 文件（UTF-8 BOM，兼容 Excel）。

    Returns:
        导出的文件路径
    """
    output_path = Path(output_path)

    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'ID', '标题', '分类', '优先级', '状态',
            '创建日期', '截止日期', '完成日期',
            '量化产出', '子任务进度', '备注',
            '领导交办', '跨年', '受阻',
        ])

        for task in tasks:
            quantities = '; '.join(
                f"{q.label}: {q.value} {q.unit}" for q in task.quantities
            ) if task.quantities else ''

            from models.task import calc_subtask_progress
            progress = calc_subtask_progress(task.subtasks)
            progress_str = f"{progress['done']}/{progress['total']}" if progress['total'] > 0 else ''

            writer.writerow([
                task.id,
                task.title,
                task.category,
                task.priority,
                task.status,
                task.createdDate,
                task.deadline or '',
                task.completedDate or '',
                quantities,
                progress_str,
                task.notes,
                '是' if task.isLeaderAssigned else '否',
                '是' if task.isCrossYear else '否',
                '是' if task.isBlocked else '否',
            ])

    return str(output_path)


def export_tasks_csv_text(tasks: list[Task]) -> str:
    """将任务列表导出为 CSV 字符串（用于剪贴板）。"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'ID', '标题', '分类', '优先级', '状态',
        '创建日期', '截止日期', '完成日期',
        '量化产出', '子任务进度', '备注',
    ])

    for task in tasks:
        quantities = '; '.join(
            f"{q.label}: {q.value} {q.unit}" for q in task.quantities
        ) if task.quantities else ''

        from models.task import calc_subtask_progress
        progress = calc_subtask_progress(task.subtasks)
        progress_str = f"{progress['done']}/{progress['total']}" if progress['total'] > 0 else ''

        writer.writerow([
            task.id,
            task.title,
            task.category,
            task.priority,
            task.status,
            task.createdDate,
            task.deadline or '',
            task.completedDate or '',
            quantities,
            progress_str,
            task.notes,
        ])

    return output.getvalue()
