#!/usr/bin/env python3
"""data.json 持久化：文件夹发现、读写、备份轮转、revision 读取。"""

import json
import os
import shutil
import sys
from datetime import UTC
from pathlib import Path

from launcher.constants import BACKUP_BASENAME, BACKUP_COUNT
from launcher.state import get_state
from launcher.state_persistence import read_state


def _get_search_bases() -> list[str]:
    """Return directories to search for wjl-config.txt / data.json."""
    bases: list[str] = []
    if getattr(sys, "frozen", False):
        bases.append(os.path.dirname(sys.executable))
    else:
        # launcher 包在 project_root/launcher/，项目根在上一级
        bases.append(str(Path(__file__).resolve().parent.parent))
    bases.append(os.getcwd())
    return bases


def _try_read_config_txt(debug: bool = False) -> str | None:
    """Read the first valid directory path from any wjl-config.txt found."""
    for base in _get_search_bases():
        config_file = os.path.join(base, "wjl-config.txt")
        if os.path.isfile(config_file):
            try:
                raw = Path(config_file).read_text("utf-8")
                path = raw.strip().lstrip("﻿")
                if not path:
                    continue
                if not os.path.isabs(path):
                    path = os.path.join(os.path.dirname(config_file), path)
                path = os.path.abspath(path)
                if os.path.isdir(path):
                    if debug:
                        print(f"[*] 从 {config_file} 读取到数据文件夹: {path}")
                    return path
                if debug:
                    print(f"[!] {config_file} 中的路径不存在或不是目录: {path}")
            except Exception as e:
                if debug:
                    print(f"[!] 读取 {config_file} 失败: {e}")
                continue
    return None


def _try_find_data_json() -> str | None:
    """If a data.json exists next to the exe or in cwd, use its parent folder."""
    for base in _get_search_bases():
        candidate = os.path.join(base, "data.json")
        if os.path.isfile(candidate):
            return os.path.abspath(base)
    return None


def get_configured_data_folder(debug: bool = False) -> str | None:
    """Return the configured data folder path, or None if not configured.

    Precedence:
      1. wjl-config.txt in launcher / cwd (single line, UTF-8)
      2. dataFolderPath key in .wjl-state.json
      3. A data.json file found next to the exe / in cwd
    """
    path = _try_read_config_txt(debug=debug)
    if path:
        return path

    state = read_state()
    path = state.get("dataFolderPath")
    if path and os.path.isdir(path):
        if debug:
            print(f"[*] 从 .wjl-state.json 读取到数据文件夹: {path}")
        return os.path.abspath(path)

    path = _try_find_data_json()
    if path:
        if debug:
            print(f"[*] 自动发现 data.json 所在文件夹: {path}")
        return path

    if debug:
        print("[!] 未找到配置的数据文件夹")
    return None


def _default_data_dict() -> dict:
    from datetime import datetime
    return {
        "version": 1,
        "lastModified": datetime.now(UTC).isoformat(),
        "settings": {
            "weeklySummaryDay": 5,
            "monthlySummaryDay": 28,
            "aiPolishFlag": False,
            "categories": [
                "人员调配", "内部招聘", "奖惩管理", "绩效管理",
                "劳动关系", "交办事项", "其他",
            ],
        },
        "projects": [],
        "tasks": [],
        "archives": {"weeks": {}, "months": {}, "years": {}},
    }


def get_data_folder_path() -> str | None:
    """Return currently active data folder path from app state."""
    return get_state().data_folder_path


def read_data_json(data_folder_path: str | None = None) -> dict | None:
    """Read data.json from the configured data folder."""
    folder = data_folder_path or get_data_folder_path()
    if not folder:
        return None
    data_path = Path(folder) / "data.json"
    if not data_path.exists():
        default_data = _default_data_dict()
        write_data_json(default_data, folder)
        return default_data
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return _default_data_dict()


def _backup_data_json(data_path: Path) -> None:
    """Rotate data.json into a .bak snapshot chain before it is overwritten."""
    def p(name: str) -> Path:
        return data_path.with_name(name)

    try:
        oldest = p(f"{BACKUP_BASENAME}.{BACKUP_COUNT - 1}")
        if oldest.exists():
            oldest.unlink()

        for i in range(BACKUP_COUNT - 1, 0, -1):
            src = p(BACKUP_BASENAME if i == 1 else f"{BACKUP_BASENAME}.{i - 1}")
            dst = p(f"{BACKUP_BASENAME}.{i}")
            if src.exists():
                if dst.exists():
                    dst.unlink()
                src.replace(dst)

        if data_path.exists():
            shutil.copy2(data_path, p(BACKUP_BASENAME))
    except OSError:
        pass


def write_data_json(data: dict, data_folder_path: str | None = None) -> bool:
    """Write data.json to the configured data folder atomically."""
    folder = data_folder_path or get_data_folder_path()
    if not folder:
        return False
    data_path = Path(folder) / "data.json"
    try:
        data_path.parent.mkdir(parents=True, exist_ok=True)
        _backup_data_json(data_path)
        tmp_path = data_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(data_path)
        return True
    except Exception:
        return False


def current_revision(data_folder_path: str | None = None) -> int | None:
    """Return the current data.json revision, or None if undetermined."""
    folder = data_folder_path or get_data_folder_path()
    if not folder:
        return None
    data_path = Path(folder) / "data.json"
    if not data_path.exists():
        return None
    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        rev = data.get("revision")
        return rev if isinstance(rev, int) else 0
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
