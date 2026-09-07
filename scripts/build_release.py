#!/usr/bin/env python3
"""一键发布脚本：构建前端 → 生成图标 → PyInstaller 打包 → 更新 release → 打 zip。

用法：
    python scripts/build_release.py            # 完整出包
    python scripts/build_release.py --skip-frontend
    python scripts/build_release.py --skip-installer
"""

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASE_DIR = ROOT / "release" / "工作清单"
DIST_EXE = ROOT / "dist" / "工作清单.exe"
RELEASE_EXE = RELEASE_DIR / "工作清单.exe"
ZIP_PATH = ROOT / "release" / "工作清单.zip"

IS_WINDOWS = sys.platform == "win32"

# `.wjl-state.json`、`data.json` 等本地/运行期文件不应进入发布包。
# 客户端会按日期轮转状态备份（`.wjl-state.json.bak-YYYYMMDD`），按前缀一并排除。
_EXCLUDE_NAMES = {
    "data.json",
    "data.json.bak",
    "data.json.corrupt",
}
_WJL_STATE_PREFIX = ".wjl-state.json"


def run_command(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=ROOT, check=True)


def npm_command() -> str:
    return "npm.cmd" if IS_WINDOWS else "npm"


def ensure_icon() -> bool:
    run_command([sys.executable, str(ROOT / "scripts" / "make_icon.py")])
    return True


def build_frontend() -> bool:
    run_command([npm_command(), "run", "build"])
    return True


def build_installer() -> bool:
    # 清理旧的打包输出，避免把上一次生成的 exe 当作静态资源打进新包（递归膨胀）。
    if DIST_EXE.exists():
        DIST_EXE.unlink()
    run_command([sys.executable, "-m", "PyInstaller", str(ROOT / "launcher.spec"), "--noconfirm"])
    return True


def copy_exe_to_release() -> bool:
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(DIST_EXE, RELEASE_EXE)
    return True


def create_release_zip() -> bool:
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(RELEASE_DIR.rglob("*")):
            if file.is_dir():
                continue
            rel = file.relative_to(RELEASE_DIR).as_posix()
            # 只排除本地运行状态和真实密钥文件，保留 .env.example 模板
            if (
                file.name in _EXCLUDE_NAMES
                or file.name.startswith(_WJL_STATE_PREFIX)
                or rel.endswith("/.env")
                or rel == ".env"
            ):
                continue
            zf.write(file, arcname=rel)
    return True


def main() -> bool:
    parser = argparse.ArgumentParser(description="工作清单一键发布")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过 npm run build")
    parser.add_argument("--skip-installer", action="store_true", help="跳过 PyInstaller，但会重新拷贝已存在的 dist exe 到 release")
    args, _ = parser.parse_known_args()

    steps: list[tuple[str, object]] = [
        ("ensure_icon", ensure_icon),
        ("build_frontend", build_frontend),
        ("build_installer", build_installer),
        ("copy_exe_to_release", copy_exe_to_release),
        ("create_release_zip", create_release_zip),
    ]
    if args.skip_frontend:
        steps.remove(("build_frontend", build_frontend))
    if args.skip_installer:
        steps.remove(("build_installer", build_installer))

    print("[*] 开始发布构建")
    for name, fn in steps:
        print(f"[*] 执行 {name}")
        fn()
    print(f"[*] 发布完成: {ZIP_PATH}")
    return True


if __name__ == "__main__":
    main()
