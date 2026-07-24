#!/usr/bin/env python3
"""
polish.py — AI 润色脚本，用于工作日志周/月/年小结的语言润色。

读取 WPS 云文档文件夹中的 data.json，找到 archives 中 aiPolished=false 且
summary 非空的条目，调用 AI API 润色后写回。

支持 DeepSeek 和通义千问（DashScope）两种 API，通过 .env 文件配置。

用法：
    python polish.py [data.json 路径]

如果不提供路径参数，默认在当前目录下寻找 data.json。
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_RETRIES = 2  # additional retries after the initial attempt

CHINA_TZ = timezone(timedelta(hours=8))

PROMPT_TEMPLATE = """你是一位资深文书助理。请对以下工作小结进行语言润色。

## 润色要求
1. **文风**：正式、简洁、结构化——符合正式工作报告规范
2. **用数据说话**：保留并突出量化产出和具体数据
3. **避免口语化**：删除"搞定了""推进了一下"等日常表达
4. **避免情绪化**：不添加"极大地""非常"等主观修饰词
5. **句式**：使用规范的书面语句式，段落层次分明
6. **保留原意**：不增加原文没有的信息，不删除原文已有的事实

## 输出格式
只输出润色后的文本，不要添加任何解释、标记或前缀。

## 原文
{summary}

请开始润色："""


# ---------------------------------------------------------------------------
# Config loading (S5)
# ---------------------------------------------------------------------------

def load_config(env_path: str | None = None) -> dict[str, str]:
    """Read API configuration from a .env file.

    Expected keys: AI_API_KEY, AI_ENDPOINT, AI_MODEL.
    Returns a dict with keys ``api_key``, ``endpoint``, ``model``.

    Raises FileNotFoundError if the file doesn't exist.
    Raises ValueError if AI_API_KEY is missing.
    """
    if env_path is None:
        # Default: look for .env next to this script
        env_path = str(Path(__file__).resolve().parent / ".env")

    if not os.path.isfile(env_path):
        raise FileNotFoundError(f".env 文件不存在: {env_path}")

    env_vars: dict[str, str] = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            env_vars[key] = value

    api_key = env_vars.get("AI_API_KEY", "")
    if not api_key:
        raise ValueError("AI_API_KEY 未在 .env 文件中配置")

    return {
        "api_key": api_key,
        "endpoint": env_vars.get("AI_ENDPOINT", "https://api.deepseek.com"),
        "model": env_vars.get("AI_MODEL", "deepseek-chat"),
    }


# ---------------------------------------------------------------------------
# Data I/O (helpers)
# ---------------------------------------------------------------------------

def load_data(filepath: str) -> dict[str, Any]:
    """Read and parse data.json from *filepath*."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(filepath: str, data: dict[str, Any]) -> None:
    """Write *data* back to *filepath* as pretty-printed JSON."""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Finding unpolished items (S1)
# ---------------------------------------------------------------------------

def find_unpolished(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return a list of archive items that have a summary and aiPolished=False.

    Each returned item is a dict with:
        type  — "week", "month", or "year"
        key   — the archive key (e.g. "2026-W29", "2026-07", "2026")
        summary — the raw summary text
    """
    results: list[dict[str, Any]] = []
    archives = data.get("archives")
    if not archives:
        return results

    for archive_type, label in [("weeks", "week"), ("months", "month"), ("years", "year")]:
        bucket = archives.get(archive_type, {})
        for key, entry in bucket.items():
            if not isinstance(entry, dict):
                continue
            summary = entry.get("summary")
            if summary and not entry.get("aiPolished", False):
                results.append({
                    "type": label,
                    "key": key,
                    "summary": summary,
                })

    return results


# ---------------------------------------------------------------------------
# Prompt building (S2)
# ---------------------------------------------------------------------------

def build_polish_prompt(summary_text: str) -> str:
    """Wrap *summary_text* in the 国企人力资源文风 prompt template."""
    return PROMPT_TEMPLATE.format(summary=summary_text)


# ---------------------------------------------------------------------------
# AI API call with retry (S3)
# ---------------------------------------------------------------------------

def call_ai_api(prompt: str, config: dict[str, str]) -> str:
    """Call the AI chat-completions API and return the polished text.

    Uses OpenAI-compatible /v1/chat/completions endpoint.
    Retries up to *MAX_RETRIES* times on network errors and HTTP 5xx.

    Raises Exception after exhausting retries.
    """
    url = f"{config['endpoint'].rstrip('/')}/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {config['api_key']}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": config["model"],
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    last_error: Exception | None = None

    for attempt in range(1 + MAX_RETRIES):  # 1 initial + N retries
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=120)

            if resp.status_code < 500:
                # 2xx / 4xx — don't retry client errors
                if resp.status_code == 200:
                    body = resp.json()
                    return body["choices"][0]["message"]["content"]
                else:
                    # 4xx — no retry
                    raise Exception(
                        f"AI API 返回错误 {resp.status_code}: {resp.text}"
                    )

            # 5xx — will be caught below and retried
            last_error = Exception(
                f"AI API 返回 {resp.status_code}: {resp.text[:200]}"
            )

        except Exception as exc:
            last_error = exc
            # Don't retry if it's a 4xx we already raised
            if "AI API 返回错误 4" in str(exc) or "AI API 返回错误 40" in str(exc):
                raise

        if attempt < MAX_RETRIES:
            wait = (attempt + 1) * 2  # 2s, 4s backoff
            print(f"  ⚠ 第 {attempt + 1} 次调用失败，{wait}s 后重试...")
            time.sleep(wait)

    raise Exception(
        f"AI API 调用失败（已重试 {MAX_RETRIES} 次，共 {1 + MAX_RETRIES} 次尝试）: {last_error}"
    )


# ---------------------------------------------------------------------------
# Applying polish back to data (S4)
# ---------------------------------------------------------------------------

def apply_polish(
    data: dict[str, Any], item: dict[str, Any], polished_text: str
) -> None:
    """Write *polished_text* back into *data* at the location described by *item*.

    Sets ``aiPolished = True`` and updates ``lastModified``.
    """
    type_map = {"week": "weeks", "month": "months", "year": "years"}
    bucket_key = type_map[item["type"]]
    entry = data["archives"][bucket_key][item["key"]]
    entry["summary"] = polished_text
    entry["aiPolished"] = True
    data["lastModified"] = datetime.now(CHINA_TZ).isoformat()


# ---------------------------------------------------------------------------
# Preview helpers
# ---------------------------------------------------------------------------

def _truncate(text: str, max_len: int = 100) -> str:
    """Truncate *text* to *max_len* characters, appending '…' if needed."""
    text = text.replace("\n", " ").strip()
    if len(text) <= max_len:
        return text
    return text[:max_len] + "…"


def _type_label(type_: str) -> str:
    """Return a Chinese label for the archive type."""
    return {"week": "周报", "month": "月报", "year": "年报"}.get(type_, type_)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Command-line entry point."""
    # --- Parse arguments ---
    if len(sys.argv) > 1:
        data_path = sys.argv[1]
    else:
        data_path = "data.json"

    if not os.path.isfile(data_path):
        print(f"❌ 找不到文件: {data_path}")
        print("用法: python polish.py [data.json 路径]")
        sys.exit(1)

    # --- Load config ---
    try:
        config = load_config()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("请在 scripts/ 目录下创建 .env 文件，内容参考 README.md")
        sys.exit(1)
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

    print(f"📡 API 端点: {config['endpoint']}")
    print(f"🧠 模型:     {config['model']}")

    # --- Load data ---
    try:
        data = load_data(data_path)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"❌ 读取 data.json 失败: {e}")
        sys.exit(1)

    # --- Find unpolished items ---
    items = find_unpolished(data)

    if not items:
        print("✅ 没有需要润色的条目，data.json 中所有小结已润色完毕。")
        return

    # --- Preview ---
    print(f"\n📋 找到 {len(items)} 条待润色的小结：\n")

    for i, item in enumerate(items, 1):
        label = _type_label(item["type"])
        preview = _truncate(item["summary"], 100)
        print(f"  [{i}] {label} | {item['key']}")
        print(f"      {preview}\n")

    # --- Confirm ---
    try:
        answer = input("是否逐项润色？(y/n): ").strip().lower()
    except (KeyboardInterrupt, EOFError):
        print("\n👋 已取消")
        return

    if answer not in ("y", "yes"):
        print("👋 已取消")
        return

    # --- Process each item ---
    success_count = 0
    fail_count = 0

    for i, item in enumerate(items, 1):
        label = _type_label(item["type"])
        print(f"\n{'─' * 50}")
        print(f"[{i}/{len(items)}] 正在润色 {label} {item['key']}…")

        try:
            prompt = build_polish_prompt(item["summary"])
            polished = call_ai_api(prompt, config)
            apply_polish(data, item, polished)
            print(f"  ✅ 润色完成")
            print(f"  预览: {_truncate(polished, 120)}")
            success_count += 1
        except Exception as e:
            print(f"  ❌ 润色失败: {e}")
            fail_count += 1

    # --- Save ---
    if success_count > 0:
        save_data(data_path, data)
        print(f"\n{'═' * 50}")
        print(f"💾 已保存到 {data_path}")
        print(f"   成功: {success_count} 条  |  失败: {fail_count} 条")
    else:
        print(f"\n❌ 所有条目润色失败，原始数据未被修改。")


if __name__ == "__main__":
    main()
