from launcher.state import AppState, get_state, set_state


def test_app_state_defaults():
    s = AppState()
    assert s.debug_mode is False
    assert s.data_folder_path is None
    assert s.window_hwnd is None
    assert s.allow_quit is False
    assert s.docked is False


def test_get_state_returns_singleton():
    s1 = get_state()
    s2 = get_state()
    assert s1 is s2


def test_set_state_replaces_singleton():
    new_state = AppState()
    new_state.debug_mode = True
    set_state(new_state)
    assert get_state() is new_state
    assert get_state().debug_mode is True
