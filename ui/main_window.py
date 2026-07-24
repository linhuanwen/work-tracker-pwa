"""主窗口 —— 左侧导航栏 + 右侧 QStackedWidget 页面切换"""

from PySide6.QtCore import Qt, QSize
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QVBoxLayout,
    QStackedWidget, QPushButton, QLabel, QStatusBar,
    QButtonGroup, QSizePolicy,
)
from PySide6.QtGui import QFont

from ui.app import WorkJournalApp
from ui.pages.task_page import TaskPage
from ui.pages.weekly_page import WeeklyPage
from ui.pages.monthly_page import MonthlyPage
from ui.pages.yearly_page import YearlyPage
from ui.pages.projects_page import ProjectsPage
from ui.pages.settings_page import SettingsPage


class MainWindow(QMainWindow):
    """工作清单主窗口"""

    NAV_ITEMS = [
        ("📋  任务清单", "tasks"),
        ("📅  周小结",   "weekly"),
        ("📊  月小结",   "monthly"),
        ("📈  年度报告", "yearly"),
        ("📁  项目管理", "projects"),
        ("⚙  设置",     "settings"),
    ]

    def __init__(self, app: WorkJournalApp):
        super().__init__()
        self._wj_app = app
        self._pages = {}  # key → QWidget
        self._nav_buttons: dict[str, QPushButton] = {}
        self._nav_group = QButtonGroup(self)
        self._nav_group.setExclusive(True)

        self._setup_ui()
        self._connect_signals()
        self._navigate("tasks")

    # ============================================================
    # UI 搭建
    # ============================================================

    def _setup_ui(self) -> None:
        self.setWindowTitle("工作清单")
        self.setMinimumSize(960, 640)
        self.resize(1100, 750)

        # 居中显示
        screen = self.screen().availableGeometry()
        x = (screen.width() - self.width()) // 2
        y = (screen.height() - self.height()) // 2
        self.move(x, y)

        # 中央控件
        central = QWidget(objectName="centralWidget")
        self.setCentralWidget(central)
        root_layout = QHBoxLayout(central)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        # --- 左侧导航栏 ---
        nav_panel = QWidget(objectName="navPanel")
        nav_panel.setFixedWidth(180)
        nav_layout = QVBoxLayout(nav_panel)
        nav_layout.setContentsMargins(0, 0, 0, 0)
        nav_layout.setSpacing(0)

        # 标题
        title_label = QLabel("工作清单", objectName="navTitle")
        subtitle_label = QLabel("个人工作管理 & 自动小结", objectName="navSubtitle")
        nav_layout.addWidget(title_label)
        nav_layout.addWidget(subtitle_label)
        nav_layout.addSpacing(8)

        # 导航按钮
        for label_text, key in self.NAV_ITEMS:
            btn = QPushButton(label_text)
            btn.setCheckable(True)
            btn.setProperty("class", "nav-btn")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda checked, k=key: self._navigate(k))
            self._nav_group.addButton(btn)
            self._nav_buttons[key] = btn
            nav_layout.addWidget(btn)

        nav_layout.addStretch()

        # 版本信息
        version_label = QLabel("v3.0 PySide6", objectName="navSubtitle")
        version_label.setStyleSheet("padding: 8px 16px;")
        nav_layout.addWidget(version_label)

        root_layout.addWidget(nav_panel)

        # --- 右侧内容区 ---
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        right_layout.setSpacing(0)

        self._stack = QStackedWidget()
        right_layout.addWidget(self._stack)

        # 状态栏
        self._status_bar = QStatusBar()
        self.setStatusBar(self._status_bar)
        self._status_label = QLabel("就绪")
        self._status_bar.addWidget(self._status_label)

        root_layout.addWidget(right_panel, 1)

        # 应用全局样式
        self._load_stylesheet()

    def _load_stylesheet(self) -> None:
        """加载 QSS 样式表"""
        import os
        qss_path = os.path.join(os.path.dirname(__file__), 'styles.qss')
        if os.path.exists(qss_path):
            with open(qss_path, 'r', encoding='utf-8') as f:
                self.setStyleSheet(f.read())

    # ============================================================
    # 导航
    # ============================================================

    def _navigate(self, key: str) -> None:
        """切换到指定页面"""
        # 更新导航按钮选中态
        if key in self._nav_buttons:
            self._nav_buttons[key].setChecked(True)

        # 懒加载页面
        if key not in self._pages:
            page = self._create_page(key)
            self._pages[key] = page
            self._stack.addWidget(page)

        page = self._pages[key]
        self._stack.setCurrentWidget(page)

        # 每次切换页面时刷新数据
        if hasattr(page, 'refresh_data'):
            page.refresh_data()

    def _create_page(self, key: str) -> QWidget:
        """创建页面实例"""
        page_map = {
            "tasks":    lambda: TaskPage(self._wj_app),
            "weekly":   lambda: WeeklyPage(self._wj_app),
            "monthly":  lambda: MonthlyPage(self._wj_app),
            "yearly":   lambda: YearlyPage(self._wj_app),
            "projects": lambda: ProjectsPage(self._wj_app),
            "settings": lambda: SettingsPage(self._wj_app),
        }
        factory = page_map.get(key)
        if factory:
            return factory()
        return QWidget()

    # ============================================================
    # 信号连接
    # ============================================================

    def _connect_signals(self) -> None:
        """连接 App 信号到主窗口"""
        self._wj_app.save_status.connect(self._on_save_status)
        self._wj_app.data_reloaded.connect(self._on_data_reloaded)

    def _on_save_status(self, msg: str) -> None:
        self._status_label.setText(msg)

    def _on_data_reloaded(self) -> None:
        """WPS 同步后刷新当前页面"""
        current = self._stack.currentWidget()
        if hasattr(current, 'refresh_data'):
            current.refresh_data()

    # ============================================================
    # 生命周期
    # ============================================================

    def closeEvent(self, event) -> None:
        """窗口关闭时保存数据"""
        self._wj_app.cleanup()
        super().closeEvent(event)
