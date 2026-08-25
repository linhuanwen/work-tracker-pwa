#!/usr/bin/env python3
"""AI 生成总结 Word 文档。"""

from pathlib import Path

from launcher.ai import _ensure_scripts_path, _resolve_ai_config


def _summary_prompt(period_type: str, period_label: str, sections: dict) -> str:
    """Build a prompt asking the AI to produce a formal summary document."""
    section_lines = []
    for title, text in sections.items():
        section_lines.append(f"## {title}\n{text}\n")
    body = "\n".join(section_lines)

    return f"""你是一位资深文书助理。请根据以下{period_label}的工作材料，生成一份正式、简洁、结构化的工作总结 Word 文档内容。

## 写作要求
1. **文风**：正式、简洁、符合正式工作报告规范。
2. **用数据说话**：保留并突出量化产出和具体数据。
3. **避免口语化**：删除"搞定了""推进了一下"等日常表达。
4. **避免情绪化**：不添加"极大地""非常"等主观修饰词。
5. **结构化**：使用 Markdown 标题（# 一级标题、## 二级标题）和项目符号列表组织内容。
6. **不编造**：不增加原文没有的信息，不删除原文已有的事实。

## 输出格式
只输出 Markdown 格式的文档正文，不要添加任何解释、标记或前缀。第一行应为一级标题，例如"{period_label}工作总结"。

## 原始材料
{body}

请开始生成："""


def _markdown_to_docx(markdown_text: str, output_path: str) -> None:
    """Convert simple Markdown to a .docx file (Chinese-friendly)."""
    from docx import Document
    from docx.shared import Pt, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    import re

    doc = Document()
    # Set default font for the document
    style = doc.styles['Normal']
    style.font.name = 'Microsoft YaHei'
    style.font.size = Pt(10.5)
    # Set narrow margins to make better use of the narrow window if printed
    sections = doc.sections[0]
    sections.top_margin = Inches(0.6)
    sections.bottom_margin = Inches(0.6)
    sections.left_margin = Inches(0.7)
    sections.right_margin = Inches(0.7)

    for raw_line in markdown_text.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            continue
        stripped = line.lstrip()
        if stripped.startswith('# '):
            p = doc.add_heading(stripped[2:], level=1)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif stripped.startswith('## '):
            doc.add_heading(stripped[3:], level=2)
        elif stripped.startswith('### '):
            doc.add_heading(stripped[4:], level=3)
        elif stripped.startswith('- ') or stripped.startswith('* '):
            doc.add_paragraph(stripped[2:], style='List Bullet')
        elif re.match(r'^\d+\.\s', stripped):
            text = re.sub(r'^\d+\.\s', '', stripped)
            doc.add_paragraph(text, style='List Number')
        else:
            doc.add_paragraph(line)

    doc.save(output_path)


def _type_label_map() -> dict[str, tuple[str, str, str]]:
    """Map summary type to (folder_name, doc_name_prefix, period_label)."""
    return {
        'week': ('周报', '周', '周'),
        'month': ('月报', '月', '月'),
        'year': ('年报', '年度', '年'),
    }


def _summary_doc_filename(period_type: str, key: str) -> tuple[str, str]:
    """Return (folder_name, filename.docx) for the given type/key."""
    folder, _, _ = _type_label_map()[period_type]
    if period_type == 'week':
        # key format: "2026-W29"
        year, week = key.split('-W')
        filename = f"{year}年第{int(week)}周工作总结.docx"
    elif period_type == 'month':
        # key format: "2026-07"
        year, month = key.split('-')
        filename = f"{year}年{int(month)}月工作总结.docx"
    else:
        # key format: "2026"
        filename = f"{key}年度工作总结.docx"
    return folder, filename


def generate_summary_doc(data_folder_path: str, period_type: str, key: str, sections: dict) -> str:
    """Generate a Word document summary via AI and save it to the shared folder.

    Returns the saved file path. Raises an exception on failure.
    """
    if not data_folder_path:
        raise Exception("未配置数据文件夹，无法保存总结文档。")

    _ensure_scripts_path()
    try:
        from polish import call_ai_api
    except ImportError:
        raise Exception("AI 润色脚本未找到，请确保 scripts/polish.py 存在。")

    config = _resolve_ai_config()

    _, period_word, _ = _type_label_map()[period_type]
    if period_type == 'week':
        year, week = key.split('-W')
        full_label = f"{year}年第{int(week)}周"
    elif period_type == 'month':
        year, month = key.split('-')
        full_label = f"{year}年{int(month)}月"
    else:
        full_label = f"{key}年度"

    prompt = _summary_prompt(period_type, full_label, sections)
    markdown = call_ai_api(prompt, config)

    folder_name, filename = _summary_doc_filename(period_type, key)
    output_dir = Path(data_folder_path) / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename

    _markdown_to_docx(markdown, str(output_path))
    return str(output_path)
