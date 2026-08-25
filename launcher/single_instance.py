#!/usr/bin/env python3
"""单实例检测：已有实例运行时通知其显示窗口。"""

import socket
import urllib.error
import urllib.request

from launcher.constants import HOST, PORT, URL


def is_server_running() -> bool:
    try:
        s = socket.create_connection((HOST, PORT), timeout=1)
        s.close()
        return True
    except (ConnectionRefusedError, OSError):
        return False


def notify_existing_instance() -> bool:
    """向已在运行的实例 POST show。收到任何 HTTP 响应都视为成功。"""
    req = urllib.request.Request(
        f"{URL}/api/window",
        data=b'{"action":"show"}',
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=2)
        return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False
