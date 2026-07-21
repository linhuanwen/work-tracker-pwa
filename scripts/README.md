# polish.py — AI 工作小结润色脚本

独立命令行工具，读取 WPS 云文档中的 `data.json`，找到 `archives` 中尚未 AI 润色的周/月/年小结，调用大语言模型 API 进行语言润色后写回 JSON。

## 环境准备

### 1. 安装 Python

需要 Python **3.11+**（推荐 3.12）。

### 2. 安装依赖

```bash
pip install requests
```

唯一的外部依赖是 [`requests`](https://pypi.org/project/requests/) 库，用于 HTTP 调用 AI API。

### 3. 验证安装

```bash
cd scripts/
python -c "import requests; print('OK')"
```

## 配置 .env 文件

在 `scripts/` 目录下创建 `.env` 文件，填入你的 API 配置：

### DeepSeek

```env
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_ENDPOINT=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

### 通义千问（阿里云 DashScope）

```env
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
AI_MODEL=qwen-turbo
```

> **注意**：通义千问的 `AI_ENDPOINT` 需要包含 `/compatible-mode/v1` 路径前缀（因为其 OpenAI 兼容模式不是挂载在根路径下）。实际的 API URL 拼接为 `{endpoint}/chat/completions`。

### 配置项说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_API_KEY` | ✅ | API 密钥，从 DeepSeek 开放平台或阿里云 DashScope 获取 |
| `AI_ENDPOINT` | ❌ | API 基础 URL，默认为 DeepSeek |
| `AI_MODEL` | ❌ | 模型名称，默认为 `deepseek-chat` |

## 运行方式

### 基本用法

```bash
# 在 scripts/ 目录下运行（自动寻找上级目录的 data.json）
cd scripts/
python polish.py ../data.json

# 或指定完整路径
python polish.py "D:/WPS Cloud/WorkJournal/data.json"
```

### 交互流程

1. 脚本读取 `data.json`，遍历 `archives.weeks`、`archives.months`、`archives.years`
2. 列出所有 `summary` 存在且 `aiPolished = false` 的条目（类型 + 日期 + 前 100 字预览）
3. 提示 `是否逐项润色？(y/n)`，输入 `y` 或 `yes` 确认
4. 逐项调用 AI API 润色，实时显示进度
5. 全部完成后写回 JSON 文件

### 输出示例

```
📡 API 端点: https://api.deepseek.com
🧠 模型:     deepseek-chat

📋 找到 3 条待润色的小结：

  [1] 周报 | 2026-W28
      本周完成了3项人员调配工作，推进了内部招聘流程。

  [2] 月报 | 2026-07
      本月完成内部招聘2人，处理劳动合同续签5份。

  [3] 年报 | 2026
      全年围绕人力资源六大模块开展工作，重点推进人员配置优化。

是否逐项润色？(y/n): y

──────────────────────────────────────────────────
[1/3] 正在润色 周报 2026-W28…
  ✅ 润色完成
  预览: 本周完成人员调配3项，持续推进内部招聘流程。

...

══════════════════════════════════════════════════
💾 已保存到 data.json
   成功: 3 条  |  失败: 0 条
```

## 润色规则

润色 Prompt 预设**国企人力资源文风**要求：

- **正式、简洁**：符合国企人力资源部门行文规范
- **结构化**：使用规范的书面语句式
- **数据说话**：保留并突出量化产出
- **去口语化**：删除"搞定了""推进了一下"等日常表达
- **去情绪化**：不添加"极大地""非常"等主观修饰词
- **保留原意**：不增删原文事实

## 错误处理

- **网络错误**：自动重试 2 次（间隔 2s / 4s）
- **HTTP 5xx**：自动重试
- **HTTP 4xx**：不重试（API Key 错误、参数错误等）
- **部分失败**：成功的条目正常保存，失败的条目保持原样
- **全部失败**：原始数据不被修改

## 运行测试

```bash
cd scripts/
python -m pytest test_polish.py -v
```

## 数据安全

- 所有数据读写均在本地文件系统完成
- AI API 调用仅在用户主动运行脚本时发生
- 不会自动上传或同步任何数据
- 建议在运行前备份 `data.json`
