#!/usr/bin/env python3
"""Win32 窗口控制封装。

在非 Windows 平台或测试环境中提供 fake user32，避免 import 时失败。
"""

import ctypes
import ctypes.wintypes
import sys
import time

from launcher.constants import (
    WINDOW_TITLE,
    WINDOW_MIN_WIDTH,
    WINDOW_MIN_HEIGHT,
    SWP_NOZORDER,
    SWP_NOACTIVATE,
    SWP_NOMOVE,
    SW_HIDE,
    SW_MINIMIZE,
    SW_MAXIMIZE,
    SW_RESTORE,
    SPI_GETWORKAREA,
    WM_NCLBUTTONDOWN,
    HTCAPTION,
)
from launcher.state import get_state


class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]


class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.wintypes.DWORD),
        ("rcMonitor", RECT),
        ("rcWork", RECT),
        ("dwFlags", ctypes.wintypes.DWORD),
    ]


MONITOR_DEFAULTTONEAREST = 2


if sys.platform == "win32":
    class _User32:
        def __init__(self):
            self._lib = ctypes.windll.user32
            self._lib.FindWindowW.argtypes = [
                ctypes.wintypes.LPCWSTR, ctypes.wintypes.LPCWSTR
            ]
            self._lib.FindWindowW.restype = ctypes.wintypes.HWND
            self._lib.SetWindowPos.argtypes = [
                ctypes.wintypes.HWND, ctypes.wintypes.HWND,
                ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                ctypes.wintypes.UINT,
            ]
            self._lib.SetWindowPos.restype = ctypes.wintypes.BOOL
            self._lib.GetWindowRect.argtypes = [ctypes.wintypes.HWND, ctypes.c_void_p]
            self._lib.GetWindowRect.restype = ctypes.wintypes.BOOL
            self._lib.ReleaseCapture.argtypes = []
            self._lib.ReleaseCapture.restype = ctypes.wintypes.BOOL
            self._lib.SendMessageW.argtypes = [
                ctypes.wintypes.HWND, ctypes.wintypes.UINT,
                ctypes.wintypes.WPARAM, ctypes.wintypes.LPARAM,
            ]
            self._lib.SendMessageW.restype = ctypes.wintypes.LPARAM
            self._lib.PostMessageW.argtypes = [
                ctypes.wintypes.HWND, ctypes.wintypes.UINT,
                ctypes.wintypes.WPARAM, ctypes.wintypes.LPARAM,
            ]
            self._lib.PostMessageW.restype = ctypes.wintypes.BOOL
            self._lib.GetCursorPos.argtypes = [ctypes.c_void_p]
            self._lib.GetCursorPos.restype = ctypes.wintypes.BOOL
            self._lib.ShowWindow.argtypes = [ctypes.wintypes.HWND, ctypes.c_int]
            self._lib.ShowWindow.restype = ctypes.wintypes.BOOL
            self._lib.IsZoomed.argtypes = [ctypes.wintypes.HWND]
            self._lib.IsZoomed.restype = ctypes.wintypes.BOOL
            self._lib.GetDpiForWindow.argtypes = [ctypes.wintypes.HWND]
            self._lib.GetDpiForWindow.restype = ctypes.wintypes.UINT
            self._lib.SetForegroundWindow.argtypes = [ctypes.wintypes.HWND]
            self._lib.SetForegroundWindow.restype = ctypes.wintypes.BOOL
            self._lib.SystemParametersInfoW.argtypes = [
                ctypes.wintypes.UINT, ctypes.wintypes.UINT,
                ctypes.c_void_p, ctypes.wintypes.UINT,
            ]
            self._lib.SystemParametersInfoW.restype = ctypes.wintypes.BOOL
            self._lib.MonitorFromWindow.argtypes = [
                ctypes.wintypes.HWND, ctypes.wintypes.DWORD,
            ]
            self._lib.MonitorFromWindow.restype = ctypes.wintypes.HMONITOR
            self._lib.GetMonitorInfoW.argtypes = [
                ctypes.wintypes.HMONITOR, ctypes.c_void_p,
            ]
            self._lib.GetMonitorInfoW.restype = ctypes.wintypes.BOOL

        def __getattr__(self, name):
            return getattr(self._lib, name)

    user32 = _User32()
else:
    class _FakeUser32:
        def FindWindowW(self, *args):
            return 0

        def SetWindowPos(self, *args):
            return 1

        def GetWindowRect(self, *args):
            return 1

        def ReleaseCapture(self):
            return 1

        def SendMessageW(self, *args):
            return 0

        def PostMessageW(self, *args):
            return 1

        def GetCursorPos(self, point):
            point.x = 0
            point.y = 0
            return 1

        def ShowWindow(self, *args):
            return 1

        def IsZoomed(self, *args):
            return 0

        def GetDpiForWindow(self, *args):
            return 96

        def SetForegroundWindow(self, *args):
            return 1

        def SystemParametersInfoW(self, *args):
            return 1

        def MonitorFromWindow(self, *args):
            return 0

        def GetMonitorInfoW(self, *args):
            return 1

    user32 = _FakeUser32()


def _find_hwnd_by_title():
    """Fast path: find by exact window title."""
    return user32.FindWindowW(None, WINDOW_TITLE)


def _find_hwnd_by_pid():
    """Robust fallback: enumerate top-level windows and match our own PID.

    不同机器/WebView2 版本下，窗口标题可能不完全等于 WINDOW_TITLE（例如
    带有附加后缀或编码差异），导致 FindWindowW 找不到。此时按进程 PID 枚举
    窗口更可靠，保证 HWND 一定能在启动后拿到。
    """
    if sys.platform != 'win32':
        return 0

    WNDENUMPROC = ctypes.WINFUNCTYPE(
        ctypes.wintypes.BOOL,
        ctypes.wintypes.HWND,
        ctypes.wintypes.LPARAM,
    )
    current_pid = ctypes.windll.kernel32.GetCurrentProcessId()
    found = []

    @WNDENUMPROC
    def _enum_callback(hwnd, _lparam):
        if not ctypes.windll.user32.IsWindowVisible(hwnd):
            return True
        pid = ctypes.wintypes.DWORD()
        ctypes.windll.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value != current_pid:
            return True

        # Prefer a window whose title contains the app title; otherwise accept
        # the first visible top-level window owned by this process.
        title_len = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        if title_len > 0:
            buf = ctypes.create_unicode_buffer(title_len + 1)
            ctypes.windll.user32.GetWindowTextW(hwnd, buf, title_len + 1)
            if WINDOW_TITLE in buf.value:
                found.append(hwnd)
                return False
        found.append(hwnd)
        return False

    ctypes.windll.user32.EnumWindows(_enum_callback, 0)
    return found[0] if found else 0


def _find_hwnd():
    state = get_state()
    if state.window_hwnd:
        return state.window_hwnd
    hwnd = _find_hwnd_by_title()
    if hwnd:
        return hwnd
    return _find_hwnd_by_pid()


def find_and_store_hwnd():
    """Daemon: poll until the window HWND is found and cache it for API use."""
    state = get_state()
    for _ in range(100):  # ~10 seconds
        hwnd = _find_hwnd()
        if hwnd:
            state.window_hwnd = hwnd
            if state.debug_mode:
                print(f"[*] 窗口句柄已捕获 (HWND={hwnd})")
            # 启动布局与前端 /api/window 探针解耦：拿到 HWND 后立即停靠右缘，
            # 不依赖前端加载时机（避免不同分辨率/性能机器上出现窗口停在左侧）。
            dock_right()
            state.hwnd_ready.set()
            return
        time.sleep(0.1)

    if state.debug_mode:
        print("[!] 未能在 10 秒内找到窗口句柄，窗口控制 API 可能失效")


def watch_dock_right():
    """后台守护：定期检查窗口右缘是否仍贴齐所在显示器工作区右缘。

    当用户切换分辨率、DPI、任务栏位置或外接显示器布局时，自动重新贴合右缘，
    同时保留用户已经调整好的窗口宽度、高度和上下位置。
    """
    state = get_state()
    while True:
        time.sleep(2)
        hwnd = state.window_hwnd
        if not hwnd:
            continue
        rect = get_window_rect()
        if not rect:
            continue
        wa = _get_work_area(hwnd)
        if not wa:
            continue
        # 右缘未对齐才调整，避免无谓的 SetWindowPos 调用。
        if rect[2] != wa.right:
            move_resize_window(
                rect[0],
                rect[1],
                rect[2] - rect[0],
                rect[3] - rect[1],
            )


def resize_window(width: int, height: int) -> bool:
    """Resize the window to the given dimensions."""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    return user32.SetWindowPos(
        hwnd, 0, 0, 0, width, height,
        SWP_NOZORDER | SWP_NOMOVE | SWP_NOACTIVATE,
    ) != 0


def move_resize_window(left: int, top: int, width: int, height: int) -> bool:
    """Move and resize the window to the given position and dimensions.

    窗口被设计为“右侧固定侧边栏”：无论请求的 left/width 如何变化，
    这里都会强制把右缘对齐到窗口所在显示器的工作区右缘。
    因此向左拉宽（W 边缘）会改变宽度并保持右缘不动；拖动移动会被自动吸回右侧。
    """
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    wa = _get_work_area(hwnd)
    if wa:
        max_w = max(0, wa.right - wa.left)
        if width > max_w:
            width = max_w
        # 固定右缘：右缘 = 工作区右缘；left 由 width 推导。
        left = wa.right - width
    return user32.SetWindowPos(
        hwnd, 0, left, top, width, height,
        SWP_NOZORDER | SWP_NOACTIVATE,
    ) != 0


def start_drag_window() -> bool:
    """Start a native drag operation from the title-bar area."""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    pt = POINT()
    if not user32.GetCursorPos(ctypes.byref(pt)):
        return False
    lparam = ((pt.y & 0xFFFF) << 16) | (pt.x & 0xFFFF)
    user32.ReleaseCapture()
    user32.SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, lparam)
    return True

def minimize_window() -> bool:
    """Minimize the window to the taskbar."""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    user32.ShowWindow(hwnd, SW_MINIMIZE)
    return True


def toggle_maximize_window() -> tuple[bool, bool]:
    """Toggle maximize/restore. Returns (ok, maximized_after)."""
    hwnd = _find_hwnd()
    if not hwnd:
        return False, False
    if user32.IsZoomed(hwnd):
        user32.ShowWindow(hwnd, SW_RESTORE)
        return True, False
    user32.ShowWindow(hwnd, SW_MAXIMIZE)
    return True, True


def is_window_maximized() -> bool:
    """Return whether the window is currently maximized."""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    return bool(user32.IsZoomed(hwnd))


def get_min_window_size() -> tuple[int, int]:
    """OS-enforced minimum size in *physical* pixels."""
    hwnd = _find_hwnd()
    scale = 1.0
    if hwnd:
        try:
            dpi = user32.GetDpiForWindow(hwnd)
            if dpi:
                scale = dpi / 96.0
        except Exception:
            pass
    return (round(WINDOW_MIN_WIDTH * scale), round(WINDOW_MIN_HEIGHT * scale))


def _get_work_area(hwnd):
    """取窗口所在显示器的工作区；失败时回退到系统主工作区。"""
    if sys.platform == 'win32':
        monitor = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
        if monitor:
            mi = MONITORINFO()
            mi.cbSize = ctypes.sizeof(MONITORINFO)
            if user32.GetMonitorInfoW(monitor, ctypes.byref(mi)):
                return mi.rcWork

    wa = RECT()
    if user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(wa), 0):
        return wa
    return None


def dock_right():
    """启动布局：窗口停靠到其所在显示器工作区右边缘、全高、最小宽度。"""
    state = get_state()
    if state.docked:
        return
    hwnd = _find_hwnd()
    if not hwnd:
        return
    wa = _get_work_area(hwnd)
    if not wa:
        return
    min_w, _ = get_min_window_size()
    w = min_w
    h = wa.bottom - wa.top
    if move_resize_window(wa.right - w, wa.top, w, h):
        state.docked = True


def hide_window() -> bool:
    """隐藏窗口到托盘。"""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    user32.ShowWindow(hwnd, SW_HIDE)
    return True


def show_window() -> bool:
    """从托盘恢复窗口并置前。"""
    hwnd = _find_hwnd()
    if not hwnd:
        return False
    user32.ShowWindow(hwnd, SW_RESTORE)
    user32.SetForegroundWindow(hwnd)
    return True


def get_window_rect():
    """Get current window rect as (left, top, right, bottom)."""
    hwnd = _find_hwnd()
    if not hwnd:
        return None

    rect = RECT()
    if user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return (rect.left, rect.top, rect.right, rect.bottom)
    return None
