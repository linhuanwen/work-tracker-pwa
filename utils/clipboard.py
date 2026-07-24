"""剪贴板操作工具 —— 使用 Qt 原生剪贴板"""


def copy_text(text: str) -> bool:
    """复制文本到系统剪贴板。返回是否成功。"""
    try:
        from PySide6.QtWidgets import QApplication
        clipboard = QApplication.clipboard()
        if clipboard:
            clipboard.setText(text)
            return True
    except Exception:
        pass
    return False


def copy_report(title: str, sections: list[tuple[str, str]]) -> bool:
    """格式化并复制报告。

    Args:
        title: 报告标题
        sections: [(标题, 内容), ...]

    Returns:
        是否成功
    """
    lines = [title, "=" * 40, ""]
    for section_title, content in sections:
        lines.append(section_title)
        lines.append(content)
        lines.append("")
    return copy_text("\n".join(lines))
