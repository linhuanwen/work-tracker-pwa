#!/usr/bin/env python3
"""AI 配置解析与润色桥接。

配置来源（优先级从高到低）：
1. 前端「设置 → AI 配置」随请求体提交的 config（键为 api_key/endpoint/model）；
2. scripts/.env（打包版优先使用可执行文件旁的 scripts/.env，供无界面配置）。

密钥只在本地后端与本机前端间传递，不会写入云同步的 data.json。
"""

import os
import sys

from launcher.constants import PROJECT_ROOT


def _get_scripts_dir():
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "scripts")
    return os.path.join(str(PROJECT_ROOT), "scripts")


def _get_external_scripts_dir():
    """Return a user-writable scripts/ dir next to the frozen executable.

    Allows recipients of the packaged .exe to configure AI by simply placing
    a scripts/.env file next to the executable, without rebuilding.
    """
    if getattr(sys, "frozen", False):
        return os.path.join(os.path.dirname(sys.executable), "scripts")
    return None


def _ensure_scripts_path():
    scripts_dir = _get_scripts_dir()
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    # Also allow an external scripts/ dir next to the exe to override/supplement
    # the bundled one (e.g. for per-machine AI configuration).
    external = _get_external_scripts_dir()
    if external and external != scripts_dir and external not in sys.path:
        sys.path.insert(0, external)


def _resolve_ai_config() -> dict:
    """Load AI config exclusively from scripts/.env.

    When packaged, prefers an external scripts/.env next to the executable so
    the API key never needs to be bundled into the distributable.
    """
    _ensure_scripts_path()
    from polish import load_config

    candidates = []
    external = _get_external_scripts_dir()
    if external:
        candidates.append(os.path.join(external, ".env"))
    candidates.append(os.path.join(_get_scripts_dir(), ".env"))

    last_error = None
    for env_path in candidates:
        if os.path.isfile(env_path):
            try:
                return load_config(env_path)
            except FileNotFoundError:
                continue
            except ValueError as e:
                last_error = e
                continue

    if last_error is not None:
        raise Exception(f"配置错误: {last_error}")
    raise Exception(
        "未配置 AI API。请在可执行文件同目录的 scripts/.env 中设置 AI_API_KEY。"
    )

def resolve_ai_config(request_config=None) -> dict:
    """Resolve AI config: UI request config first, scripts/.env as fallback.

    *request_config* is the ``config`` object the frontend attaches to
    /api/summary and /api/polish requests (keys: api_key/endpoint/model).
    Raises a user-facing exception when the UI config lacks an API key.
    """
    if isinstance(request_config, dict) and (request_config.get("api_key") or "").strip():
        return {
            "api_key": str(request_config["api_key"]).strip(),
            "endpoint": (
                str(request_config.get("endpoint") or "").strip()
                or "https://api.deepseek.com"
            ),
            "model": (
                str(request_config.get("model") or "").strip() or "deepseek-v4-flash"
            ),
        }
    if isinstance(request_config, dict):
        # 前端提交了 config 但没填 Key：先回退 .env；仍无配置时给出设置页导向的错误
        try:
            return _resolve_ai_config()
        except Exception as env_error:
            raise Exception(
                "未配置 AI API Key。请在「设置 → AI 配置」中填写 API Key 后再试。"
            ) from env_error
    return _resolve_ai_config()


def _import_polish():
    _ensure_scripts_path()
    try:
        from polish import build_polish_prompt, call_ai_api
    except ImportError:
        raise Exception(
            "润色脚本未找到，请确保 scripts/polish.py 和 scripts/.env 文件存在。"
        )
    return build_polish_prompt, call_ai_api


def run_polish(raw_text: str, archive_type: str, request_config=None) -> str:
    """Call polish.py functions to polish *raw_text* via AI.

    Returns the polished text, or raises an exception with a user-friendly
    message explaining what went wrong.
    """
    build_polish_prompt, call_ai_api = _import_polish()
    config = resolve_ai_config(request_config)
    prompt = build_polish_prompt(raw_text)
    return call_ai_api(prompt, config)
