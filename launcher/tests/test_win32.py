from launcher.state import get_state
from launcher.win32 import (
    resize_window,
    move_resize_window,
    start_drag_window,
    minimize_window,
    toggle_maximize_window,
    is_window_maximized,
    get_min_window_size,
    dock_right,
    hide_window,
    show_window,
    get_window_rect,
)


def test_get_min_window_size(mock_user32):
    w, h = get_min_window_size()
    # 96 dpi -> scale 1.0
    assert w == 360
    assert h == 480


def test_resize_window_calls_setwindowpos(mock_user32):
    get_state().window_hwnd = 12345
    assert resize_window(800, 600) is True
    mock_user32.SetWindowPos.assert_called()


def test_minimize_window(mock_user32):
    get_state().window_hwnd = 12345
    assert minimize_window() is True
    mock_user32.ShowWindow.assert_called_with(12345, 6)


def test_toggle_maximize_window(mock_user32):
    get_state().window_hwnd = 12345
    mock_user32.IsZoomed.return_value = 0
    ok, maximized = toggle_maximize_window()
    assert ok is True
    assert maximized is True


def test_dock_right_sets_docked_flag(mock_user32):
    get_state().window_hwnd = 12345
    dock_right()
    assert get_state().docked is True


def test_get_window_rect(mock_user32):
    get_state().window_hwnd = 12345
    rect = get_window_rect()
    assert rect is not None
    assert len(rect) == 4


def test_find_and_store_hwnd_docks_right_immediately(mock_user32):
    """启动时拿到 HWND 后应立刻停靠，避免依赖前端 /api/window 探针时机。"""
    from launcher.win32 import find_and_store_hwnd
    from launcher.state import get_state

    # FindWindowW 命中即可（mock_user32 默认返回 12345）。
    find_and_store_hwnd()
    state = get_state()
    assert state.window_hwnd == 12345
    assert state.docked is True


def test_move_resize_window_keeps_right_edge_on_any_workarea(monkeypatch, mock_user32):
    """验证不同分辨率/工作区下，move_resize_window 都会让右缘贴齐 workarea.right。"""
    from launcher import win32
    from launcher.win32 import move_resize_window, RECT

    get_state().window_hwnd = 12345

    cases = [
        # (workarea_left, workarea_right, requested_left, width, expected_left)
        (0, 1920, 100, 800, 1120),
        (0, 1366, 0, 360, 1006),
        (0, 3840, 500, 1000, 2840),
        (1920, 3840, 2000, 800, 3040),  # 副屏：右缘贴副屏右侧
    ]

    for wa_left, wa_right, req_left, width, expected_left in cases:
        wa = RECT()
        wa.left = wa_left
        wa.top = 0
        wa.right = wa_right
        wa.bottom = 1080
        monkeypatch.setattr(win32, '_get_work_area', lambda hwnd, wa=wa: wa)
        mock_user32.SetWindowPos.reset_mock()

        assert move_resize_window(req_left, 50, width, 600) is True
        _, args, _ = mock_user32.SetWindowPos.mock_calls[0]
        # args: hwnd, hInsertAfter, x, y, cx, cy, flags
        assert args[2] == expected_left
        assert args[4] == width


def test_move_resize_window_clamps_width_to_workarea_width(monkeypatch, mock_user32):
    """窗口宽度超过工作区时，自动收窄到工作区宽度并贴左缘。"""
    from launcher import win32
    from launcher.win32 import move_resize_window, RECT

    get_state().window_hwnd = 12345
    wa = RECT()
    wa.left, wa.top, wa.right, wa.bottom = 0, 0, 1920, 1040
    monkeypatch.setattr(win32, '_get_work_area', lambda hwnd: wa)

    assert move_resize_window(0, 0, 3000, 800) is True
    _, args, _ = mock_user32.SetWindowPos.mock_calls[0]
    assert args[4] == 1920  # width clamped to workarea width
    assert args[2] == 0     # left = 1920 - 1920
