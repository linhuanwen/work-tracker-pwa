#!/usr/bin/env python3
"""桌面启动器主流程编排。"""

import sys
import threading
import time

from launcher.constants import TKEY_HEX, URL, WINDOW_HEIGHT, WINDOW_TITLE, WINDOW_WIDTH
from launcher.data import get_configured_data_folder
from launcher.server import is_server_running as is_local_server_running
from launcher.server import start_server
from launcher.shortcut import ensure_desktop_shortcut
from launcher.single_instance import is_server_running, notify_existing_instance
from launcher.state import get_state
from launcher.tray import on_window_closing, start_tray
from launcher.win32 import find_and_store_hwnd, watch_dock_right


def start_shortcut_creation(debug: bool = False) -> threading.Thread:
    """在后台 daemon 线程创建桌面快捷方式（非阻塞；已存在跳过；失败静默）。"""
    t = threading.Thread(
        target=ensure_desktop_shortcut, kwargs={"debug": debug}, daemon=True
    )
    t.start()
    return t


def main():
    debug = "--debug" in sys.argv
    headless = "--headless" in sys.argv

    state = get_state()
    state.debug_mode = debug
    state.headless = headless

    # Load configured data folder (if any) so /api/data can serve it
    state.data_folder_path = get_configured_data_folder(debug=debug)
    if debug or headless:
        if state.data_folder_path:
            print(f"[*] 数据文件夹: {state.data_folder_path}")
        else:
            print("[!] 没有配置数据文件夹；启动后将要求手动选择文件夹")

    # 0. 单实例：已有实例在跑 → 通知它显示窗口，本进程直接退出
    if is_server_running():
        if headless:
            if debug:
                print("[*] 已有实例在运行，本进程退出")
            sys.exit(0)
        if notify_existing_instance():
            if debug:
                print("[*] 已有实例在运行，已通知其显示窗口，本进程退出")
            sys.exit(0)
        if debug:
            print("[!] 端口被占但旧实例无响应，继续启动")

    # 1. Start HTTP server
    start_server()
    for _ in range(20):
        if is_local_server_running():
            break
        time.sleep(0.05)
    if debug or headless:
        print(f"Server started at {URL}")

    # 1.5 headless 模式：纯 HTTP 服务器，无窗口无托盘
    if headless:
        print("Headless 模式运行中（Ctrl+C 退出）")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
        return

    # 1.7 后台创建桌面快捷方式（仅打包后的桌面模式；已存在则跳过，失败静默不影响启动）。
    start_shortcut_creation(debug=debug)

    # 2. Create window

    import webview

    state.webview_window = webview.create_window(
        title=WINDOW_TITLE,
        url=URL,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        resizable=True,
        min_size=(240, 32),
        frameless=True,
        transparent=True,
        background_color=TKEY_HEX,
        on_top=False,
        confirm_close=False,
        text_select=True,
        easy_drag=False,
    )
    state.webview_window.events.closing += on_window_closing

    # 3. 系统托盘
    start_tray()

    # 4. Background thread to capture HWND for API use
    hwnd_thread = threading.Thread(target=find_and_store_hwnd, daemon=True)
    hwnd_thread.start()

    # 4.5 后台守护：分辨率/显示器布局变化时自动重新贴合右缘
    dock_watch_thread = threading.Thread(target=watch_dock_right, daemon=True)
    dock_watch_thread.start()

    # 5. GUI message loop (blocks until closed)
    webview.start(gui='edgechromium')
