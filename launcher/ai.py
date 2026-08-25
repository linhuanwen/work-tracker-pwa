#!/usr/bin/env python3
"""AI 润色桥接。

配置只从 scripts/.env 读取，不再接受前端请求中的 api_key/endpoint/model。
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

def _import_polish():
    _ensure_scripts_path()
    try:
        from polish import build_polish_prompt, call_ai_api
    except ImportError:
        raise Exception(
            "润色脚本未找到，请确保 scripts/polish.py 和 scripts/.env 文件存在。"
        )
    return build_polish_prompt, call_ai_api


def run_polish(raw_text: str, archive_type: str) -> str:
    """Call polish.py functions to polish *raw_text* via AI.

    Returns the polished text, or raises an exception with a user-friendly
    message explaining what went wrong.
    """
    build_polish_prompt, call_ai_api = _import_polish()
    config = _resolve_ai_config()
    prompt = build_polish_prompt(raw_text)
    return call_ai_api(prompt, config)
