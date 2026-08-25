import sys
from unittest.mock import MagicMock

import pytest

from launcher.state import AppState, set_state


@pytest.fixture(autouse=True)
def fresh_state():
    """Each test gets a clean AppState."""
    set_state(AppState())
    yield


@pytest.fixture
def tmp_scripts_dir(tmp_path, monkeypatch):
    """Create a temporary scripts/ dir with a fake polish.py and .env.

    Clears any cached ``polish`` module so launcher tests import the fake
    script instead of the real scripts/polish.py loaded by scripts/test_polish.
    """

    scripts_dir = tmp_path / "scripts"
    scripts_dir.mkdir()

    env_path = scripts_dir / ".env"
    env_path.write_text("AI_API_KEY=sk-test\nAI_ENDPOINT=https://api.test\nAI_MODEL=test-model\n", encoding="utf-8")

    polish_path = scripts_dir / "polish.py"
    polish_path.write_text(
        "def load_config(path):\n"
        "    return {'api_key': 'sk-test', 'endpoint': 'https://api.test', 'model': 'test-model'}\n"
        "def build_polish_prompt(text):\n"
        "    return text\n"
        "def call_ai_api(prompt, config):\n"
        "    return f'polished: {prompt}'\n",
        encoding="utf-8",
    )

    def _get_scripts_dir():
        return str(scripts_dir)

    monkeypatch.setattr("launcher.ai._get_scripts_dir", _get_scripts_dir)

    # Make sure launcher tests import the fake polish module.
    old_polish = sys.modules.pop("polish", None)
    old_path = sys.path.copy()
    sys.path.insert(0, str(scripts_dir))

    yield scripts_dir

    # Restore previous module/path state.
    sys.path[:] = old_path
    if old_polish is not None:
        sys.modules["polish"] = old_polish
    else:
        sys.modules.pop("polish", None)


@pytest.fixture
def mock_user32(monkeypatch):
    """Replace win32 user32 with a MagicMock for cross-platform tests."""
    fake = MagicMock()
    fake.FindWindowW.return_value = 12345
    fake.SetWindowPos.return_value = 1
    fake.GetWindowRect.return_value = 1
    fake.ReleaseCapture.return_value = 1
    fake.SendMessageW.return_value = 0
    fake.GetCursorPos.return_value = 1
    fake.ShowWindow.return_value = 1
    fake.IsZoomed.return_value = 0
    fake.GetDpiForWindow.return_value = 96
    fake.SetForegroundWindow.return_value = 1
    fake.SystemParametersInfoW.return_value = 1
    monkeypatch.setattr("launcher.win32.user32", fake)
    yield fake
