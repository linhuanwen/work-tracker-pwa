from launcher.summary import (
    _summary_doc_filename,
    _summary_prompt,
    generate_summary_doc,
)


def test_summary_doc_filename_week():
    folder, filename = _summary_doc_filename("week", "2026-W29")
    assert folder == "周报"
    assert filename == "2026年第29周工作总结.docx"


def test_summary_doc_filename_month():
    folder, filename = _summary_doc_filename("month", "2026-07")
    assert folder == "月报"
    assert filename == "2026年7月工作总结.docx"


def test_summary_doc_filename_year():
    folder, filename = _summary_doc_filename("year", "2026")
    assert folder == "年报"
    assert filename == "2026年度工作总结.docx"


def test_summary_prompt_contains_period_label():
    prompt = _summary_prompt("week", "2026年第29周", {"本周完成": "完成 3 项"})
    assert "2026年第29周工作总结" in prompt
    assert "完成 3 项" in prompt


def test_generate_summary_doc_writes_docx(tmp_scripts_dir, tmp_path):
    from launcher.state import get_state
    get_state().data_folder_path = str(tmp_path)

    path = generate_summary_doc(
        str(tmp_path),
        "week",
        "2026-W29",
        {"本周完成": "完成 3 项"},
    )
    assert path.endswith(".docx")
    assert (tmp_path / "周报" / "2026年第29周工作总结.docx").exists()
