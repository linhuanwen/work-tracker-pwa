# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path
a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[
        *[
            (str(Path('dist') / name), 'dist')
            for name in [
                'index.html',
                'manifest.webmanifest',
                'registerSW.js',
                'sw.js',
                'favicon.svg',
                'pwa-192x192.svg',
                'pwa-512x512.svg',
            ]
            if (Path('dist') / name).exists()
        ],
        *[
            (str(path), 'dist')
            for path in Path('dist').glob('workbox-*.js')
        ],
        ('dist/assets', 'dist/assets'),
        ('scripts/polish.py', 'scripts'),
        ('scripts/.env.example', 'scripts'),
    ],
    hiddenimports=[
        'webview',
        'webview.platforms.winforms',
        'clr',
        'pythonnet',
        # pystray 的 win32 后端是运行期 importlib 动态加载，必须显式声明
        'pystray',
        'pystray._win32',
        # AI 总结生成 Word 文档所需的运行时 import
        'requests',
        'certifi',
        'docx',
        'docx.shared',
        'docx.enum.text',
        'docx.oxml',
        'docx.oxml.ns',
        'docx.opc',
        'lxml',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'PySide6',
        'PyQt5',
        'PyQt6',
        'matplotlib',
        'numpy',
        'scipy',
        'pandas',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='工作清单',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(Path('assets') / '工作清单.ico'),
)
