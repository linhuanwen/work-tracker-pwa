"""本地检查脚本编排测试。不真正执行前端/Python 检查。"""

import sys

import check_all as ca


def test_npm_command_windows(monkeypatch):
    monkeypatch.setattr(ca, "IS_WINDOWS", True)
    assert ca.npm_command() == "npm.cmd"


def test_run_frontend_checks_commands(monkeypatch):
    calls = []
    monkeypatch.setattr(ca, "npm_command", lambda: "npm.cmd")
    monkeypatch.setattr(ca, "run_command", lambda cmd: calls.append(cmd))
    assert ca.run_frontend_checks() is True
    assert calls == [
        ["npm.cmd", "run", "typecheck"],
        ["npm.cmd", "run", "lint"],
        ["npm.cmd", "run", "format:check"],
        ["npm.cmd", "run", "test"],
    ]


def test_run_python_checks_commands(monkeypatch):
    calls = []
    monkeypatch.setattr(ca, "run_command", lambda cmd: calls.append(cmd))
    assert ca.run_python_checks() is True
    assert calls == [
        [sys.executable, "-m", "ruff", "check", "."],
        [
            sys.executable, "-m", "pytest",
            "launcher/tests", "scripts/test_build_release.py", "scripts/test_polish.py", "-q",
        ],
    ]


def test_main_runs_all_steps(monkeypatch):
    steps = []
    for name in ["run_frontend_checks", "run_python_checks"]:
        monkeypatch.setattr(ca, name, lambda _name=name: steps.append(_name) or True)
    assert ca.main() is True
    assert steps == ["run_frontend_checks", "run_python_checks"]
