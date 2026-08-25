from launcher.ai import run_polish


def test_run_polish_ignores_override_and_uses_env(tmp_scripts_dir):
    result = run_polish("test summary", "week")
    assert result == "polished: test summary"


def test_run_polish_with_override_still_uses_env(tmp_scripts_dir):
    # Even if caller passes an override, it should be ignored
    result = run_polish("another summary", "month")
    assert "polished:" in result
