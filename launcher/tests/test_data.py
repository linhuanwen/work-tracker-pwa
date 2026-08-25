import json
from pathlib import Path

from launcher.state import get_state
from launcher.data import (
    get_configured_data_folder,
    read_data_json,
    write_data_json,
    current_revision,
)


def test_get_configured_data_folder_prefers_wjl_config_txt(tmp_path, monkeypatch):
    target = tmp_path / "target"
    target.mkdir()
    (tmp_path / "wjl-config.txt").write_text(str(target), encoding="utf-8")

    monkeypatch.setattr(
        "launcher.data._get_search_bases",
        lambda: [str(tmp_path)],
    )
    assert get_configured_data_folder() == str(target)


def test_get_configured_data_folder_falls_back_to_state(tmp_path, monkeypatch):
    state_file = tmp_path / ".wjl-state.json"
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    state_file.write_text(
        json.dumps({"dataFolderPath": str(data_dir)}, ensure_ascii=False),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "launcher.data._get_search_bases",
        lambda: [str(tmp_path)],
    )
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(state_file),
    )
    assert get_configured_data_folder() == str(data_dir)


def test_read_data_json_creates_default_when_missing(tmp_path):
    get_state().data_folder_path = str(tmp_path)
    data = read_data_json()
    assert data is not None
    assert data["version"] == 1
    assert data["tasks"] == []
    assert (tmp_path / "data.json").exists()


def test_write_and_read_data_json(tmp_path):
    get_state().data_folder_path = str(tmp_path)
    payload = {"version": 1, "revision": 5, "tasks": [], "projects": [], "archives": {}}
    assert write_data_json(payload)
    read = read_data_json()
    assert read["revision"] == 5


def test_current_revision(tmp_path):
    get_state().data_folder_path = str(tmp_path)
    write_data_json({"version": 1, "revision": 7})
    assert current_revision() == 7


def test_backup_rotation(tmp_path):
    get_state().data_folder_path = str(tmp_path)
    for i in range(7):
        write_data_json({"version": 1, "revision": i})

    backups = sorted(tmp_path.glob("data.json.bak*"))
    names = [b.name for b in backups]
    assert "data.json.bak" in names
    # 最近 5 份快照
    assert len([n for n in names if n.startswith("data.json.bak")]) <= 5
