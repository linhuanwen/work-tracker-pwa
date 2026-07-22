"""
工作清单 PWA 启动器
双击此文件 -> 自动启动本地服务器 -> 打开浏览器
"""

import http.server
import os
import sys
import webbrowser
import threading
import time
import socket

PORT = 5173
HOST = "127.0.0.1"


def safe_print(msg):
    """安全打印 - 兼容 Windows GBK 控制台"""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('gbk', errors='replace').decode('gbk', errors='replace'))


def get_dist_dir():
    """找到 dist/ 目录 —— 支持 PyInstaller 打包和直接运行"""
    if getattr(sys, "frozen", False):
        bundle_dir = sys._MEIPASS
    else:
        bundle_dir = os.path.dirname(os.path.abspath(__file__))

    dist_path = os.path.join(bundle_dir, "dist")
    if os.path.isdir(dist_path):
        return dist_path

    fallback = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
    if os.path.isdir(fallback):
        return fallback

    cwd_fallback = os.path.join(os.getcwd(), "dist")
    if os.path.isdir(cwd_fallback):
        return cwd_fallback

    safe_print("[错误] 找不到 dist/ 文件夹，请确保 dist/ 与启动程序在同一目录")
    safe_print(f"   当前目录: {os.getcwd()}")
    input("按任意键退出...")
    sys.exit(1)


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, port)) == 0


def main():
    dist_dir = get_dist_dir()

    if is_port_in_use(PORT):
        safe_print(f"[提示] 端口 {PORT} 已被占用，可能已有实例在运行，直接打开浏览器...")
        webbrowser.open(f"http://{HOST}:{PORT}")
        input("按任意键退出...")
        return

    os.chdir(dist_dir)

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

    server = http.server.ThreadingHTTPServer((HOST, PORT), QuietHandler)

    safe_print("=" * 50)
    safe_print("   工作清单 PWA 已启动")
    safe_print("=" * 50)
    safe_print(f"   地址: http://{HOST}:{PORT}")
    safe_print(f"   文件目录: {dist_dir}")
    safe_print("")
    safe_print("   浏览器已自动打开，开始使用吧!")
    safe_print("")
    safe_print("   注意: 请勿关闭此窗口，否则程序会停止")
    safe_print("   用完后直接关闭此窗口即可")
    safe_print("=" * 50)

    def open_browser():
        time.sleep(0.5)
        webbrowser.open(f"http://{HOST}:{PORT}")

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        safe_print("")
        safe_print("正在关闭...")
        server.shutdown()
        safe_print("已退出")


if __name__ == "__main__":
    main()
