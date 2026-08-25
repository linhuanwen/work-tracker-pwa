#!/usr/bin/env python3
"""共享可变状态容器。

原 monolithic launcher 中的模块级全局变量统一迁移到 AppState，
方便跨模块共享与测试隔离。
"""

import threading


class AppState:
    def __init__(self):
        self.debug_mode: bool = False
        self.headless: bool = False
        self.data_folder_path: str | None = None

        # 窗口相关
        self.window_hwnd: int | None = None
        self.hwnd_ready: threading.Event = threading.Event()
        self.webview_window = None
        self.tray_icon = None
        self.allow_quit: bool = False
        self.docked: bool = False


_app_state = AppState()


def get_state() -> AppState:
    return _app_state


def set_state(state: AppState) -> None:
    global _app_state
    _app_state = state
