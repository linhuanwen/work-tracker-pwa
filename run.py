#!/usr/bin/env python3
"""桌面启动器入口。

用法:
    python run.py             （无控制台，带桌面窗口+托盘）
    python run.py --debug     （带控制台信息）
    python run.py --headless  （纯 HTTP 服务器，无窗口，供浏览器 PWA）
"""

from launcher.main import main

if __name__ == "__main__":
    main()
