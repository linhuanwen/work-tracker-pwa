#!/usr/bin/env python3
"""工作清单 PWA - 桌面启动器包。

后台 HTTP 服务器 + 无边框透明 WebView2 窗口 + 系统托盘。
"""

from pathlib import Path

# 项目根目录（launcher 包的上级）
PROJECT_ROOT = Path(__file__).resolve().parent.parent

HOST = "127.0.0.1"
PORT = 5173
URL = f"http://{HOST}:{PORT}"

# Transparency key — near-black, rare in UI, reliable for OS transparency
TKEY_HEX = '#010101'
TKEY_RGB = (1, 1, 1)

WINDOW_WIDTH = 520
WINDOW_HEIGHT = 780
WINDOW_TITLE = '工作清单'
WINDOW_MIN_WIDTH = 360    # logical (DPI-independent) pixels
WINDOW_MIN_HEIGHT = 480   # logical (DPI-independent) pixels

# 允许访问本地 API 的 Origin / Host
ALLOWED_ORIGINS = (
    f"http://{HOST}:{PORT}",      # http://127.0.0.1:5173
    f"http://localhost:{PORT}",   # http://localhost:5173
)
ALLOWED_HOSTS = (
    f"{HOST}:{PORT}",             # 127.0.0.1:5173
    f"localhost:{PORT}",          # localhost:5173
)

# Win32 constants (kept here so win32.py can import them without circular deps)
SWP_NOZORDER = 0x0004
SWP_NOMOVE = 0x0002
SWP_NOACTIVATE = 0x0010

SW_HIDE = 0
SW_MINIMIZE = 6
SW_MAXIMIZE = 3
SW_RESTORE = 9

SPI_GETWORKAREA = 0x0030
WM_NCLBUTTONDOWN = 0x00A1
HTCAPTION = 2

# 窗口扩展样式相关（用于让窗口不进任务栏、只留系统托盘）
GWL_EXSTYLE = -20
WS_EX_APPWINDOW = 0x00040000   # 强制出现在任务栏
WS_EX_TOOLWINDOW = 0x00000080  # 工具窗口：不显示在任务栏和 Alt+Tab

# 自动快照保留数量
BACKUP_COUNT = 5
BACKUP_BASENAME = "data.json.bak"
