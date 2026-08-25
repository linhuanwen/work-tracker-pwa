
from launcher.state_persistence import read_state, write_state


def test_read_state_missing_file_returns_empty_dict(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    assert read_state() == {}


def test_write_and_read_state(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    write_state({"dataFolderPath": "C:/data", "lastFolderName": "data"})
    assert read_state()["dataFolderPath"] == "C:/data"


def test_read_state_invalid_json_returns_empty_dict(tmp_path, monkeypatch):
    state_file = tmp_path / ".wjl-state.json"
    state_file.write_text("not json", encoding="utf-8")
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(state_file),
    )
    assert read_state() == {}
