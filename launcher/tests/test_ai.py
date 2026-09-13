import pytest

from launcher.ai import resolve_ai_config, run_polish


def test_no_request_config_falls_back_to_env(tmp_scripts_dir):
    # 未随请求提交 config 时，回退到 scripts/.env
    config = resolve_ai_config(None)
    assert config == {
        "api_key": "sk-test",
        "endpoint": "https://api.test",
        "model": "test-model",
    }


def test_request_config_wins_over_env(tmp_scripts_dir):
    # 前端「设置 → AI 配置」提交的 config 优先于 .env
    config = resolve_ai_config(
        {"api_key": "sk-ui", "endpoint": "https://ui.test", "model": "ui-model"}
    )
    assert config == {
        "api_key": "sk-ui",
        "endpoint": "https://ui.test",
        "model": "ui-model",
    }


def test_request_config_applies_defaults_for_missing_fields(tmp_scripts_dir):
    config = resolve_ai_config({"api_key": " sk-ui "})
    assert config["api_key"] == "sk-ui"
    assert config["endpoint"] == "https://api.deepseek.com"
    assert config["model"] == "deepseek-v4-flash"


def test_request_config_without_key_falls_back_to_env(tmp_scripts_dir):
    # 前端提交了 config 但没填 Key：先回退 .env 配置
    config = resolve_ai_config({"api_key": "   ", "model": "x"})
    assert config["api_key"] == "sk-test"


def test_request_config_without_key_and_no_env_raises_ui_hint(monkeypatch):
    # .env 也没有时，给出设置页导向的错误而不是笼统的 .env 提示
    def _no_env():
        raise Exception("未配置 AI API。请设置 scripts/.env 中的 AI_API_KEY。")

    monkeypatch.setattr("launcher.ai._resolve_ai_config", _no_env)
    with pytest.raises(Exception, match="设置 → AI 配置"):
        resolve_ai_config({"api_key": ""})


def test_run_polish_without_request_config_uses_env(tmp_scripts_dir):
    result = run_polish("test summary", "week")
    assert result == "polished: test summary"


def test_run_polish_with_request_config_uses_ui_config(tmp_scripts_dir):
    result = run_polish("another summary", "month", {"api_key": "sk-ui"})
    assert "polished:" in result
