import socket

from launcher.single_instance import is_server_running, notify_existing_instance


def test_is_server_running_false_when_port_free():
    assert is_server_running() is False


def test_is_server_running_true_when_port_bound():
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(("127.0.0.1", 5173))
    server_socket.listen(1)
    try:
        assert is_server_running() is True
    finally:
        server_socket.close()


def test_notify_existing_instance_returns_false_when_port_free():
    assert notify_existing_instance() is False
