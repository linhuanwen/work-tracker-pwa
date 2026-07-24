#!/usr/bin/env python3
"""工作清单 -- PySide6 桌面应用入口

用法:
    python main.py                              # 自动查找 data.json
    python main.py data.json                    # 指定数据文件
    python main.py "D:/WPS/工作清单/data.json"

作为 exe 运行时，数据文件路径优先级：
    1. 命令行参数
    2. exe 同目录下的 wjl-config.txt
    3. exe 同目录下的 data.json
    4. 当前工作目录下的 data.json
"""

import sys
import os
from pathlib import Path

from PySide6.QtWidgets import QApplication
from PySide6.QtGui import QIcon

from ui.app import WorkJournalApp, find_data_file
from ui.main_window import MainWindow


def main():
    # 高 DPI 支持
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("工作清单")
    app.setOrganizationName("wjl")

    # 查找数据文件
    data_path = find_data_file()
    print(f"[*] 数据文件: {data_path}")

    # 创建应用核心
    wj_app = WorkJournalApp(data_path)
    wj_app.setup_file_watcher()

    # 创建并显示主窗口
    window = MainWindow(wj_app)
    window.show()

    # 启动事件循环
    sys.exit(app.exec())


if __name__ == '__main__':
    # 导入 Qt 命名空间（在 main 保护内延迟加载）
    from PySide6 import QtCore as Qt
    main()
