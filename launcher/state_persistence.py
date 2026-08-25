#!/usr/bin/env python3
""".wjl-state.json 读写。"""

import json
import os
import sys

from launcher.constants import PROJECT_ROOT


def get_state_path():
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = str(PROJECT_ROOT)
    return os.path.join(base, ".wjl-state.json")


def read_state():
    try:
        with open(get_state_path(), "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_state(state):
    with open(get_state_path(), "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
