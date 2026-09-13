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


def _post_state(payload: dict, tmp_path, monkeypatch) -> dict:
    import json as _json

    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    server = _start_test_server()
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=2)
        conn.request(
            "POST",
            "/api/state",
            body=_json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Host": "127.0.0.1:5173",
            },
        )
        resp = conn.getresponse()
        data = _json.loads(resp.read().decode("utf-8"))
        conn.close()
        return data
    finally:
        server.shutdown()


def test_api_state_rejects_relative_data_folder(tmp_path, monkeypatch):
    # “共享”这类相对文件夹名不应被注册成数据文件夹路径
    data = _post_state({"dataFolderPath": "共享"}, tmp_path, monkeypatch)
    assert data.get("ok") is False
    assert "绝对路径" in data.get("error", "")


def test_api_state_rejects_nonexistent_data_folder(tmp_path, monkeypatch):
    data = _post_state(
        {"dataFolderPath": str(tmp_path / "no_such_dir")}, tmp_path, monkeypatch
    )
    assert data.get("ok") is False


def test_api_state_accepts_existing_absolute_data_folder(tmp_path, monkeypatch):
    data = _post_state({"dataFolderPath": str(tmp_path)}, tmp_path, monkeypatch)
    assert data.get("ok") is True


def test_api_state_get_hides_invalid_stale_data_folder(tmp_path, monkeypatch):
    # 启动时解析失败（相对路径/目录不存在）的残留配置，GET 不应再暴露，
    # 否则前端会误以为已配置并进入后端模式却读不到数据。
    from launcher.state_persistence import write_state

    monkeypatch.setattr(
        "launcher.state_persistence.get_state_path",
        lambda: str(tmp_path / ".wjl-state.json"),
    )
    write_state({"dataFolderPath": "共享"})
    server = _start_test_server()
    try:
        conn = http.client.HTTPConnection(HOST, PORT, timeout=2)
        conn.request("GET", "/api/state", headers={"Host": "127.0.0.1:5173"})
        resp = conn.getresponse()
        import json as _json

        data = _json.loads(resp.read().decode("utf-8"))
        conn.close()
        assert "dataFolderPath" not in data
    finally:
        server.shutdown()
