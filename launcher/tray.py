#!/usr/bin/env python3
"""系统托盘。"""

import os
import threading

from launcher.constants import WINDOW_TITLE
from launcher.state import get_state
from launcher.win32 import hide_window, show_window


def make_tray_image():
    """内存中绘制托盘图标（无需外部图标文件/字体）。"""
    from PIL import Image, ImageDraw

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 2, 62, 62], radius=14, fill=(74, 108, 247, 255))
    white = (255, 255, 255, 255)
    d.line([(14, 20), (19, 26), (28, 13)], fill=white, width=5, joint="curve")
    d.line([(34, 20), (50, 20)], fill=white, width=5)
    d.ellipse([17, 30, 23, 36], fill=white)
    d.line([(34, 33), (50, 33)], fill=white, width=5)
    d.ellipse([17, 43, 23, 49], fill=white)
    d.line([(34, 46), (50, 46)], fill=white, width=5)
    return img


def start_tray():
    """启动系统托盘图标（左键=显示主界面，右键菜单含退出）。"""
    state = get_state()
    import pystray

    menu = pystray.Menu(
        pystray.MenuItem("显示主界面", lambda icon, item: show_window(), default=True),
        pystray.MenuItem("退出", quit_app),
    )
    state.tray_icon = pystray.Icon("wjl-tray", make_tray_image(), WINDOW_TITLE, menu)
    threading.Thread(target=state.tray_icon.run, daemon=True).start()


def on_window_closing():
    """pywebview closing 事件：默认否决关闭、改为隐藏到托盘。"""
    state = get_state()
    if state.allow_quit:
        return True
    hide_window()
    return False


def quit_app(icon=None, item=None):
    """托盘菜单「退出」：真正结束程序。"""
    state = get_state()
    state.allow_quit = True
    if state.debug_mode:
        print("[*] 托盘退出，正在关闭…", flush=True)
    if state.tray_icon is not None:
        try:
            state.tray_icon.stop()
        except Exception:
            pass
    win = state.webview_window
    if win is not None:
        win.destroy()
    else:
        os._exit(0)
