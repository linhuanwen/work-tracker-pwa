#!/usr/bin/env python3
"""桌面快捷方式自动创建。

在桌面版启动器（打包后的 exe）首次启动时，自动在桌面创建一个指向 exe 的
"工作清单.lnk" 快捷方式，方便用户像常规桌面软件一样进入，而不必把 exe 放桌面。

实现原则：
- 新增依赖为零：通过 PowerShell + WScript.Shell 的 COM 创建 .lnk。
- 非侵入：快捷方式已存在则跳过，不覆盖用户自定义。
- 失败静默：任何异常被吞掉（仅 debug 打印），绝不阻断启动。
"""

import os
import subprocess
import sys

IS_WINDOWS = sys.platform == "win32"

SHORTCUT_NAME = "工作清单.lnk"

# FOLDERID_Desktop（Public 无，用户桌面专用）
_FOLDERID_Desktop = "{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}"


def is_frozen() -> bool:
    """是否处于 PyInstaller 打包后的 exe 环境。"""
    return bool(getattr(sys, "frozen", False))


def current_exe_path() -> str | None:
    """返回当前运行的可执行文件路径；仅打包环境有意义，源码运行返回 None。"""
    if not is_frozen():
        return None
    return sys.executable


def desktop_dir(debug: bool = False) -> str | None:
    """返回用户桌面目录；优先 SHGetKnownFolderPath，失败回退 %USERPROFILE%/Desktop。"""
    if IS_WINDOWS:
        try:
            import ctypes

            # 直接构造 FOLDERID_Desktop 的 GUID：{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}
            class GUID(ctypes.Structure):
                _fields_ = [
                    ("Data1", ctypes.c_ulong),
                    ("Data2", ctypes.c_ushort),
                    ("Data3", ctypes.c_ushort),
                    ("Data4", ctypes.c_ubyte * 8),
                ]

            guid = GUID()
            guid.Data1 = 0xB4BFCC3A
            guid.Data2 = 0xDB2C
            guid.Data3 = 0x424C
            guid.Data4 = (0xB0, 0x29, 0x7F, 0xE9, 0x9A, 0x87, 0xC6, 0x41)

            get_folder = ctypes.windll.shell32.SHGetKnownFolderPath
            get_folder.argtypes = [
                ctypes.POINTER(GUID),
                ctypes.c_ulong,
                ctypes.c_void_p,
                ctypes.POINTER(ctypes.c_wchar_p),
            ]
            get_folder.restype = ctypes.c_long

            p = ctypes.c_wchar_p()
            hr = get_folder(
                ctypes.byref(guid), 0, None, ctypes.byref(p)
            )
            if hr == 0 and p.value:
                return p.value

            if debug:
                print(f"[*] SHGetKnownFolderPath 失败 (hr={hr})，回退 Desktop 环境变量")
        except Exception as e:
            if debug:
                print(f"[*] 获取桌面路径异常: {e}")

    # 回退：%USERPROFILE%\Desktop
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    candidate = os.path.join(home, "Desktop")
    if os.path.isdir(candidate):
        return candidate
    return None


def shortcut_path(desktop: str) -> str:
    return os.path.join(desktop, SHORTCUT_NAME)


def invoke_ps(script: str) -> None:
    """真正执行 PowerShell（薄层，测试中可替换）。"""
    creationflags = 0
    if sys.platform == "win32":
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
        check=True,
        capture_output=True,
        creationflags=creationflags,
        timeout=20,
    )


def create_shortcut(target: str, lnk_path: str, debug: bool = False) -> bool:
    """通过 PowerShell 创建指向 target 的 .lnk 快捷方式。返回是否成功。"""
    work_dir = os.path.dirname(target)
    # 脚本内用单引号转义路径中的引号风险（路径含单引号场景极罕见，此处做基本转义）。
    esc = lambda s: s.replace("'", "''")
    script = (
        f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{esc(lnk_path)}');"
        f"$s.TargetPath='{esc(target)}';"
        f"$s.WorkingDirectory='{esc(work_dir)}';"
        f"$s.IconLocation='{esc(target)},0';"
        "$s.Save()"
    )
    try:
        invoke_ps(script)
        return True
    except Exception as e:
        if debug:
            print(f"[*] 创建桌面快捷方式失败: {e}")
        return False


def ensure_desktop_shortcut(debug: bool = False) -> bool:
    """确保桌面存在"工作清单"快捷方式。

    返回：
      - True：快捷方式已存在或创建成功
      - False：无法创建（非 Windows / 源码运行 / 失败）
    任何异常都不会向外抛出。
    """
    try:
        if not IS_WINDOWS:
            return False

        exe = current_exe_path()
        if not exe:
            # 源码直接运行（未打包）——不创建快捷方式
            return False

        desktop = desktop_dir(debug)
        if not desktop:
            return False

        lnk = shortcut_path(desktop)
        if os.path.exists(lnk):
            # 已存在：尊重用户自定义，不覆盖
            return True

        ok = create_shortcut(exe, lnk, debug)
        if debug:
            print(f"[*] 桌面快捷方式{'创建成功' if ok else '创建失败或不创建'}: {lnk}")
        return ok
    except Exception as e:
        if debug:
            print(f"[*] ensure_desktop_shortcut 异常: {e}")
        return False
