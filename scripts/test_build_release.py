"""C1 — 发布流程脚本化测试。

不真正执行 npm / pyinstaller / 打包，只验证编排逻辑和参数拼装。
"""

import sys
import zipfile

import build_release as br
import pytest


@pytest.fixture
def tmp_project(tmp_path, monkeypatch):
    """构造一个临时项目根，包含 dist/ 和 release/工作清单/ 骨架。"""
    (tmp_path / "dist").mkdir()
    (tmp_path / "release" / "工作清单").mkdir(parents=True)
    (tmp_path / "release" / "工作清单" / "使用说明.txt").write_text("说明", encoding="utf-8")
    monkeypatch.setattr(br, "ROOT", tmp_path)
    monkeypatch.setattr(br, "RELEASE_DIR", tmp_path / "release" / "工作清单")
    monkeypatch.setattr(br, "DIST_EXE", tmp_path / "dist" / "工作清单.exe")
    monkeypatch.setattr(br, "RELEASE_EXE", tmp_path / "release" / "工作清单" / "工作清单.exe")
    monkeypatch.setattr(br, "ZIP_PATH", tmp_path / "release" / "工作清单.zip")
    return tmp_path


def test_root_is_repo_root():
    assert br.ROOT.name == "06 rili" or (br.ROOT / "launcher.spec").exists()


def test_npm_command_uses_npm_cmd_on_windows(monkeypatch):
    monkeypatch.setattr(br, "IS_WINDOWS", True)
    assert br.npm_command() == "npm.cmd"


def test_npm_command_uses_npm_on_non_windows(monkeypatch):
    monkeypatch.setattr(br, "IS_WINDOWS", False)
    assert br.npm_command() == "npm"


def test_ensure_icon_runs_icon_generator(tmp_project, monkeypatch):
    calls = []
    monkeypatch.setattr(br, "run_command", lambda cmd: calls.append(cmd))
    assert br.ensure_icon() is True
    assert calls[-1] == [sys.executable, str(tmp_project / "scripts" / "make_icon.py")]


def test_build_frontend_runs_npm_build(tmp_project, monkeypatch):
    calls = []
    monkeypatch.setattr(br, "npm_command", lambda: "npm.cmd")
    monkeypatch.setattr(br, "run_command", lambda cmd: calls.append(cmd))
    assert br.build_frontend() is True
    assert calls[-1] == ["npm.cmd", "run", "build"]


def test_build_installer_runs_pyinstaller(tmp_project, monkeypatch):
    calls = []
    monkeypatch.setattr(br, "run_command", lambda cmd: calls.append(cmd))
    assert br.build_installer() is True
    assert calls[-1] == [sys.executable, "-m", "PyInstaller", str(tmp_project / "launcher.spec"), "--noconfirm"]


def test_copy_exe_to_release(tmp_project):
    src = tmp_project / "dist" / "工作清单.exe"
    src.write_bytes(b"exe-bytes")
    result = br.copy_exe_to_release()
    assert result is True
    assert (tmp_project / "release" / "工作清单" / "工作清单.exe").read_bytes() == b"exe-bytes"


def test_create_release_zip_excludes_local_state(tmp_project):
    (tmp_project / "dist" / "工作清单.exe").write_bytes(b"exe-bytes")
    br.copy_exe_to_release()
    # 模拟本地状态文件不应被打进 zip
    (tmp_project / "release" / "工作清单" / ".wjl-state.json").write_text("{}", encoding="utf-8")
    br.create_release_zip()
    zip_path = tmp_project / "release" / "工作清单.zip"
    assert zip_path.exists()
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        assert "工作清单.exe" in names
        assert ".wjl-state.json" not in names


def test_main_orchestrates_all_steps(tmp_project, monkeypatch):
    steps = []
    for name in ["ensure_icon", "build_frontend", "build_installer", "copy_exe_to_release", "create_release_zip"]:
        monkeypatch.setattr(br, name, lambda _name=name: steps.append(_name) or True)
    assert br.main() is True
    assert steps == ["ensure_icon", "build_frontend", "build_installer", "copy_exe_to_release", "create_release_zip"]
