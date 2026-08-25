"""S1 — 桌面快捷方式模块 shortcut.py 测试。

验证编排逻辑（外部行为），不真正写桌面、不跑 PowerShell：
- 非 frozen（源码运行）→ 不创建，返回 False
- 快捷方式已存在 → 不重复创建，返回 True
- 不存在 → 调用一次创建，PS 脚本含正确 Target/WorkingDirectory
- invoke_ps 抛异常 → 被吞掉，返回 False，不向上抛
- 非 Windows 平台 → 返回 False 不创建
"""


import pytest

import launcher.shortcut as sc


@pytest.fixture(autouse=True)
def fake_platform(monkeypatch):
    """默认在 win32 平台，个别用例再覆盖。"""
    monkeypatch.setattr(sc, "IS_WINDOWS", True)
    yield


@pytest.fixture
def frozen_exe(monkeypatch):
    """模拟打包后的 exe 环境。"""
    monkeypatch.setattr(sc, "is_frozen", lambda: True)
    monkeypatch.setattr(sc, "current_exe_path", lambda: r"C:\App\工作清单\工作清单.exe")
    yield


@pytest.fixture
def fake_desktop(monkeypatch, tmp_path):
    """把桌面目录指向临时目录，避免污染真实桌面。"""
    desktop = tmp_path / "Desktop"
    desktop.mkdir()
    monkeypatch.setattr(sc, "desktop_dir", lambda debug=False: str(desktop))
    return desktop


def test_source_mode_does_not_create(monkeypatch):
    monkeypatch.setattr(sc, "is_frozen", lambda: False)
    create = lambda target, lnk: (_ for _ in ()).throw(AssertionError("不应创建"))
    monkeypatch.setattr(sc, "create_shortcut", create)
    assert sc.ensure_desktop_shortcut() is False


def test_existing_shortcut_skips(frozen_exe, fake_desktop, monkeypatch):
    lnk = fake_desktop / "工作清单.lnk"
    lnk.write_text("dummy", encoding="utf-8")
    called = []
    monkeypatch.setattr(
        sc, "create_shortcut", lambda target, lnk, debug=False: called.append((target, lnk)) or True,
    )
    assert sc.ensure_desktop_shortcut() is True
    assert called == []


def test_creates_shortcut_when_missing(frozen_exe, fake_desktop, monkeypatch):
    called = []
    monkeypatch.setattr(
        sc, "create_shortcut",
        lambda target, lnk, debug=False: called.append((target, lnk)) or True,
    )
    assert sc.ensure_desktop_shortcut() is True
    assert len(called) == 1
    target, lnk = called[0]
    assert target == r"C:\App\工作清单\工作清单.exe"
    assert lnk.endswith("工作清单.lnk")


def test_create_shortcut_builds_correct_ps_script(frozen_exe, monkeypatch, tmp_path):
    """断言传给 PowerShell 的脚本包含正确 TargetPath / WorkingDirectory。"""
    lnk = str(tmp_path / "工作清单.lnk")
    captured = {}
    def fake_invoke(script):
        captured["script"] = script
    monkeypatch.setattr(sc, "invoke_ps", fake_invoke)

    assert sc.create_shortcut(r"C:\App\工作清单\工作清单.exe", lnk) is True
    s = captured["script"]
    assert r"C:\App\工作清单\工作清单.exe" in s
    assert r"C:\App\工作清单" in s  # WorkingDirectory
    assert lnk in s


def test_failure_is_silent(frozen_exe, fake_desktop, monkeypatch):
    def boom(*a):
        raise RuntimeError("powershell missing")
    monkeypatch.setattr(sc, "create_shortcut", boom)
    # 不抛异常，返回 False
    assert sc.ensure_desktop_shortcut(debug=True) is False


def test_non_windows_returns_false(frozen_exe, monkeypatch):
    monkeypatch.setattr(sc, "IS_WINDOWS", False)
    create = lambda target, lnk: (_ for _ in ()).throw(AssertionError("不应创建"))
    monkeypatch.setattr(sc, "create_shortcut", create)
    assert sc.ensure_desktop_shortcut() is False


def test_create_shortcut_escapes_single_quotes(frozen_exe, monkeypatch, tmp_path):
    """路径含单引号时，PS 单引号字符串需要转义，避免脚本被截断。"""
    lnk = str(tmp_path / "工作清单.lnk")
    target = r"C:\App\O'Brien\工作清单.exe"
    captured = {}

    def fake_invoke(script):
        captured["script"] = script

    monkeypatch.setattr(sc, "invoke_ps", fake_invoke)
    assert sc.create_shortcut(target, lnk) is True
    assert "O''Brien" in captured["script"]
