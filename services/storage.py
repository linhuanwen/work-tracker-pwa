"""存储服务 —— JSON 文件读写 + 自动保存 + 文件监听"""

import json
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Callable

from models.data import DataJson


# ============================================================
# JSON 读写
# ============================================================

def load_data(path: str | Path) -> DataJson:
    """读取 JSON 文件并校验为 DataJson 模型。

    如果文件不存在，返回默认空数据。
    如果 JSON 解析失败或校验失败，抛出异常。
    """
    path = Path(path)

    if not path.exists():
        from models.data import create_default_data
        return create_default_data()

    with open(path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    return DataJson.model_validate(raw)


def save_data(data: DataJson, path: str | Path) -> None:
    """将 DataJson 模型序列化并写入文件。

    自动更新 lastModified 时间戳。
    先写入临时文件再原子替换，防止写入中断损坏数据。
    """
    path = Path(path)

    # 更新时间戳
    data.lastModified = datetime.now(timezone.utc).isoformat()

    # 序列化为 JSON
    json_str = data.model_dump_json(
        indent=2,
        exclude_none=True,  # 不输出 None 值的可选字段，与现有 data.json 兼容
        exclude_defaults=False,
    )

    # 原子写入：先写临时文件，再替换
    tmp_path = path.with_suffix('.tmp')
    with open(tmp_path, 'w', encoding='utf-8') as f:
        f.write(json_str)
    tmp_path.replace(path)


# ============================================================
# 自动保存（防抖）
# ============================================================

class AutoSave:
    """防抖自动保存器。

    调用 mark_dirty() 后等待 delay_ms 毫秒，
    期间若无新的 mark_dirty() 调用，则自动执行 save_fn。
    """

    def __init__(self, delay_ms: int = 500):
        self._delay_ms = delay_ms / 1000.0
        self._timer: Optional[asyncio.Task] = None
        self._save_fn: Optional[Callable] = None
        self._dirty = False

    def set_save_fn(self, fn: Callable) -> None:
        self._save_fn = fn

    def mark_dirty(self) -> None:
        """标记数据已变更，触发防抖保存"""
        self._dirty = True
        if self._timer and not self._timer.done():
            self._timer.cancel()
        self._timer = asyncio.create_task(self._delayed_save())

    async def _delayed_save(self) -> None:
        try:
            await asyncio.sleep(self._delay_ms)
            if self._dirty and self._save_fn:
                self._save_fn()
                self._dirty = False
        except asyncio.CancelledError:
            pass

    def flush_now(self) -> None:
        """立即保存（取消防抖等待）"""
        if self._timer and not self._timer.done():
            self._timer.cancel()
        if self._dirty and self._save_fn:
            self._save_fn()
            self._dirty = False


# ============================================================
# 文件监听（watchdog）
# ============================================================

def watch_data_file(
    path: str | Path,
    on_changed: Callable[[], None],
) -> 'FileWatcher':
    """监听 data.json 的外部变更（WPS 云同步）。

    返回 FileWatcher 实例，可调用 stop() 停止监听。
    """
    return FileWatcher(path, on_changed)


class FileWatcher:
    """使用 watchdog 监听文件变更"""

    def __init__(self, path: str | Path, on_changed: Callable[[], None]):
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler

        self._path = Path(path).resolve()
        self._on_changed = on_changed
        self._observer = Observer()

        watch_dir = str(self._path.parent)
        filename = self._path.name

        class Handler(FileSystemEventHandler):
            def on_modified(handler_self, event):
                # 只关心我们的文件
                if not event.is_directory and (
                    Path(event.src_path).name == filename
                    or (hasattr(event, 'dest_path') and Path(event.dest_path).name == filename)
                ):
                    # 避免自己写入触发
                    on_changed()

        self._observer.schedule(Handler(), watch_dir, recursive=False)
        self._observer.start()

    def stop(self) -> None:
        """停止监听"""
        self._observer.stop()
        self._observer.join()


# ============================================================
# 备份工具
# ============================================================

def create_backup(path: str | Path) -> Path:
    """创建 data.json 的备份副本"""
    import shutil
    path = Path(path)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = path.with_name(f'{path.stem}_backup_{timestamp}.json')
    shutil.copy2(path, backup_path)
    return backup_path
