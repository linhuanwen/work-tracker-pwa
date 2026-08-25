#!/usr/bin/env python3
"""本地检查脚本：提交/发布前跑一遍前端 + Python 质量门禁。

用法：
    python scripts/check_all.py
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IS_WINDOWS = sys.platform == "win32"


def run_command(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=ROOT, check=True)


def npm_command() -> str:
    return "npm.cmd" if IS_WINDOWS else "npm"


def run_frontend_checks() -> bool:
    run_command([npm_command(), "run", "typecheck"])
    run_command([npm_command(), "run", "lint"])
    run_command([npm_command(), "run", "format:check"])
    run_command([npm_command(), "run", "test"])
    return True


def run_python_checks() -> bool:
    run_command([sys.executable, "-m", "ruff", "check", "."])
    run_command([
        sys.executable, "-m", "pytest",
        "launcher/tests", "scripts/test_build_release.py", "scripts/test_polish.py", "-q",
    ])
    return True


def main() -> bool:
    steps = [("前端检查", run_frontend_checks), ("Python 检查", run_python_checks)]
    print("[*] 开始全量检查")
    for name, fn in steps:
        print(f"[*] {name}")
        fn()
    print("[*] 全部检查通过")
    return True


if __name__ == "__main__":
    main()
