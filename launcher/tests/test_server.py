import http.client
import threading
import time

from launcher.constants import HOST, PORT
from launcher.server import RequestHandler, _is_allowed_host, _is_allowed_origin


def test_allowed_origin_accepts_none_and_whitelist():
    assert _is_allowed_origin(None) is True
    assert _is_allowed_origin("http://127.0.0.1:5173") is True
    assert _is_allowed_origin("http://localhost:5173") is True
    assert _is_allowed_origin("http://evil.com") is False


def test_allowed_host_accepts_whitelist():
    assert _is_allowed_host("127.0.0.1:5173") is True
    assert _is_allowed_host("localhost:5173") is True
    assert _is_allowed_host("evil.com") is False
    assert _is_allowed_host(None) is False


def _start_test_server():
    import http.server
    server = http.server.ThreadingHTTPServer((HOST, PORT), RequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    # wait briefly for server to start
    for _ in range(20):
        try:
            conn = http.client.HTTPConnection(HOST, PORT, timeout=0.5)
            conn.request("GET", "/api/state")
            conn.close()
            break
        except Exception:
            time.sleep(0.05)
    return server


def test_api_state_rejects_evil_origin(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    server = _start_test_server()
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=2)
        conn.request("GET", "/api/state", headers={"Origin": "http://evil.com", "Host": "127.0.0.1:5173"})
        resp = conn.getresponse()
        assert resp.status == 403
        conn.close()
    finally:
        server.shutdown()


def test_api_state_accepts_no_origin(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    server = _start_test_server()
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=2)
        conn.request("GET", "/api/state", headers={"Host": "127.0.0.1:5173"})
        resp = conn.getresponse()
        assert resp.status == 200
        conn.close()
    finally:
        server.shutdown()
