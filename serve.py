"""
工作清单 PWA 后台服务器
由桌面 VBScript 启动，静默运行，无窗口
关闭方式：任务管理器结束进程，或访问 http://127.0.0.1:5173/shutdown
"""

import http.server
import os
import sys
import threading
import socket

PORT = 5173
HOST = "127.0.0.1"


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

    sys.exit(1)


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理：静态文件 + /shutdown 端点"""

    def do_GET(self):
        # /shutdown 端点：优雅关闭服务器
        if self.path == '/shutdown':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write('服务器已停止，可以关闭此页面。'.encode('utf-8'))
            # 在新线程中关闭，避免阻塞当前请求
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        # 其他请求走静态文件
        super().do_GET()

    def log_message(self, format, *args):
        pass  # 静默，无日志输出


def main():
    dist_dir = get_dist_dir()
    os.chdir(dist_dir)

    server = http.server.ThreadingHTTPServer((HOST, PORT), RequestHandler)

    # 浏览器由桌面 VBS 脚本负责打开，exe 只做纯服务器
    print(f"Work journal server running at http://{HOST}:{PORT}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
