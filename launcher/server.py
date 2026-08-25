#!/usr/bin/env python3
"""本地 HTTP 服务器。

提供静态文件（dist/）与 /api/* 端点，并做 Origin/Host 校验，
只允许应用自身前端访问敏感接口。
"""

import http.server
import json
import os
import sys
import threading

from launcher.constants import (
    HOST,
    PORT,
    ALLOWED_ORIGINS,
    ALLOWED_HOSTS,
    PROJECT_ROOT,
)
from launcher.state import get_state
from launcher.data import read_data_json, write_data_json, current_revision
from launcher.state_persistence import read_state, write_state
from launcher.win32 import (
    dock_right,
    resize_window,
    move_resize_window,
    start_drag_window,
    minimize_window,
    toggle_maximize_window,
    is_window_maximized,
    get_min_window_size,
    get_window_rect,
    hide_window,
    show_window,
)
from launcher.ai import run_polish
from launcher.summary import generate_summary_doc


def _is_allowed_origin(origin: str | None) -> bool:
    return origin is None or origin in ALLOWED_ORIGINS


def _is_allowed_host(host: str | None) -> bool:
    return host in ALLOWED_HOSTS


def _check_request(handler: http.server.BaseHTTPRequestHandler) -> bool:
    return (
        _is_allowed_origin(handler.headers.get("Origin"))
        and _is_allowed_host(handler.headers.get("Host"))
    )


def _send_cors_headers(handler: http.server.BaseHTTPRequestHandler, origin: str | None):
    if origin and origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if not _check_request(self):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        _send_cors_headers(self, origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        origin = self.headers.get("Origin")

        if self.path == '/api/state':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            _send_cors_headers(self, origin)
            self.end_headers()
            state = read_state()
            if get_state().data_folder_path:
                state["dataFolderPath"] = get_state().data_folder_path
            self.wfile.write(json.dumps(state, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/data':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            _send_cors_headers(self, origin)
            self.end_headers()
            data = read_data_json()
            if data is None:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(b'{"error":"data folder not configured"}')
                return
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return

        if self.path == '/api/window':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            # 启动早期前端可能比 HWND 捕获线程更快发起首次探针。
            # 这里等待 HWND 就绪（最多 3 秒），确保首次响应就能返回真实窗口坐标，
            # 避免窗口停在左侧、拖动失效。headless/纯浏览器模式没有桌面窗口，不等待。
            state = get_state()
            if not state.headless:
                state.hwnd_ready.wait(3.0)
            dock_right()
            rect = get_window_rect()
            maximized = is_window_maximized()
            min_w, min_h = get_min_window_size()
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            _send_cors_headers(self, origin)
            self.end_headers()
            if rect:
                self.wfile.write(json.dumps({
                    "left": rect[0], "top": rect[1],
                    "right": rect[2], "bottom": rect[3],
                    "width": rect[2] - rect[0],
                    "height": rect[3] - rect[1],
                    "maximized": maximized,
                    "minWidth": min_w,
                    "minHeight": min_h,
                }).encode('utf-8'))
            else:
                self.wfile.write(json.dumps({
                    "width": 520, "height": 780, "maximized": False,
                    "minWidth": min_w, "minHeight": min_h,
                }).encode('utf-8'))
            return

        if self.path == '/shutdown':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            _send_cors_headers(self, origin)
            self.end_headers()
            self.wfile.write(b'OK')
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        super().do_GET()

    def do_POST(self):
        origin = self.headers.get("Origin")

        if self.path == '/api/state':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                state = json.loads(body)
                write_state(state)
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                _send_cors_headers(self, origin)
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
            return

        if self.path == '/api/window':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                action = data.get("action", "")
                state = get_state()
                if state.debug_mode:
                    print(f"[*] /api/window POST: {data}", flush=True)
                if action == "resize":
                    w = int(data.get("width", 520))
                    h = int(data.get("height", 780))
                    ok = resize_window(w, h)
                    self._json_ok({"ok": ok}, origin)
                    return
                if action == "move_resize":
                    x = int(data.get("x", 0))
                    y = int(data.get("y", 0))
                    w = int(data.get("width", 520))
                    h = int(data.get("height", 780))
                    ok = move_resize_window(x, y, w, h)
                    self._json_ok({"ok": ok}, origin)
                    return
                if action == "start_drag":
                    ok = start_drag_window()
                    self._json_ok({"ok": ok}, origin)
                    return
                if action == "minimize":
                    ok = minimize_window()
                    self._json_ok({"ok": ok}, origin)
                    return
                if action == "toggle_maximize":
                    ok, maximized = toggle_maximize_window()
                    self._json_ok({"ok": ok, "maximized": maximized}, origin)
                    return
                if action == "close":
                    ok = hide_window()
                    self._json_ok({"ok": ok}, origin)
                    return
                if action == "show":
                    ok = show_window()
                    self._json_ok({"ok": ok}, origin)
                    return
            except (json.JSONDecodeError, ValueError):
                pass
            self.send_response(400)
            self.end_headers()
            return

        if self.path == '/api/data':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)

                expected = payload.get("expectedRevision")
                if isinstance(expected, int):
                    current_rev = current_revision()
                    if current_rev is not None and current_rev != expected:
                        self.send_response(409)
                        self.send_header('Content-type', 'application/json; charset=utf-8')
                        _send_cors_headers(self, origin)
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "ok": False,
                            "conflict": True,
                            "serverRevision": current_rev,
                        }).encode('utf-8'))
                        return
                    payload["revision"] = expected + 1

                ok = write_data_json(payload)
                self.send_response(200 if ok else 500)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                _send_cors_headers(self, origin)
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": ok,
                    "revision": payload.get("revision"),
                }).encode('utf-8'))
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
            return

        if self.path == '/api/summary':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                period_type = payload.get('type', 'week')
                key = payload.get('key', '')
                sections = payload.get('sections', {})
                if period_type not in ('week', 'month', 'year'):
                    self._json_ok({"ok": False, "error": "invalid type"}, origin)
                    return
                if not key:
                    self._json_ok({"ok": False, "error": "key is empty"}, origin)
                    return

                saved_path = generate_summary_doc(
                    get_state().data_folder_path, period_type, key, sections
                )
                self._json_ok({"ok": True, "path": saved_path}, origin)
            except Exception as e:
                self._json_ok({"ok": False, "error": str(e)}, origin)
            return

        if self.path == '/api/polish':
            if not _check_request(self):
                self.send_response(403)
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body)
                raw_text = payload.get('text', '')
                archive_type = payload.get('type', 'week')
                if not raw_text or not raw_text.strip():
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    _send_cors_headers(self, origin)
                    self.end_headers()
                    self.wfile.write(json.dumps({"ok": False, "error": "text is empty"}).encode('utf-8'))
                    return

                polished = run_polish(raw_text, archive_type)
                self._json_ok({"ok": True, "polished": polished}, origin)
            except Exception as e:
                self._json_ok({"ok": False, "error": str(e)}, origin)
            return

        self.send_response(404)
        self.end_headers()

    def _json_ok(self, data: dict, origin: str | None):
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        _send_cors_headers(self, origin)
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def log_message(self, format, *args):
        pass


def get_dist_dir():
    if getattr(sys, "frozen", False):
        bundle_dir = sys._MEIPASS
    else:
        bundle_dir = str(PROJECT_ROOT)

    for candidate in [
        os.path.join(bundle_dir, "dist"),
        os.path.join(str(PROJECT_ROOT), "dist"),
        os.path.join(os.getcwd(), "dist"),
    ]:
        if os.path.isdir(candidate):
            return candidate
    sys.exit("ERROR: dist/ directory not found")


def start_server():
    dist_dir = get_dist_dir()
    os.chdir(dist_dir)
    server = http.server.ThreadingHTTPServer((HOST, PORT), RequestHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server


def is_server_running():
    """Keep local helper for server module self-checks."""
    import socket
    try:
        s = socket.create_connection((HOST, PORT), timeout=1)
        s.close()
        return True
    except (ConnectionRefusedError, OSError):
        return False
