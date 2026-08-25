"""S2 — 启动器接入桌面快捷方式。

验证 start_shortcut_creation 在后台 daemon 线程调用 ensure_desktop_shortcut，
且失败不向外抛出。
"""

import threading

from unittest.mock import MagicMock, patch

import launcher.main as main  # noqa: F401 — ensure module importable


def test_start_shortcut_creation_runs_in_daemon_thread_with_debug():
    captured = {}

    def fake_thread(target=None, kwargs=None, daemon=None):
        captured["target"] = target
        captured["kwargs"] = kwargs
        captured["daemon"] = daemon
        # 模拟线程直接执行目标函数
        target(**kwargs)
        return MagicMock()

    with patch("launcher.main.ensure_desktop_shortcut") as mock_ensure, \
         patch("launcher.main.threading.Thread", side_effect=fake_thread):
        thread = main.start_shortcut_creation(debug=True)

    assert captured["target"] is mock_ensure
    assert captured["kwargs"] == {"debug": True}
    assert captured["daemon"] is True
    mock_ensure.assert_called_once_with(debug=True)
    assert thread is not None


def test_start_shortcut_creation_default_debug_false():
    with patch("launcher.main.ensure_desktop_shortcut") as mock_ensure:
        main.start_shortcut_creation()
        mock_ensure.assert_called_once_with(debug=False)
