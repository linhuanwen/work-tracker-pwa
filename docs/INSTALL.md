# 安装指南

> 工作清单 —— 个人任务管理与工作日志 PWA

---

## 系统要求

| 要求 | 说明 |
|------|------|
| 操作系统 | Windows 10（版本 1809+）或 Windows 11 |
| WebView2 Runtime | Windows 11 已内置；Windows 10 若没有请[下载安装](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| 浏览器（PWA 模式） | Chrome / Edge 较新版本 |

---

## 方式一：预打包 exe（推荐，最简单）

适合普通用户，不需要安装任何开发环境。

### 安装步骤

1. 将 `release/工作清单.exe` 复制到任意文件夹（如 `D:\软件\工作清单\`）
2. 双击 `工作清单.exe` 运行
3. 首次运行会提示选择数据存储位置——建议选在云同步文件夹中（如 WPS 云文档、OneDrive、坚果云等），实现跨设备同步
4. 窗口会自动停靠到屏幕右侧，作为侧边栏使用

### 后续启动

- 可以创建桌面快捷方式：右键 `工作清单.exe` → 发送到 → 桌面快捷方式
- 关闭窗口（X）会最小化到系统托盘，不会退出程序
- 在托盘图标上右键 → 退出，彻底关闭

### 数据同步

将数据文件夹放在云同步目录中（WPS 云文档 / OneDrive / 坚果云等），选择该文件夹作为数据目录，多设备自动同步。

---

## 方式二：PWA 模式（浏览器运行）

适合不想装 exe 的用户，直接在浏览器中使用。

### 安装步骤

1. 确保已安装 **Python 3.11+**（[下载](https://www.python.org/downloads/)）
2. 确保已安装 **Node.js 18+**（[下载](https://nodejs.org/)）
3. 在项目目录下执行：

```bash
# 安装 Node.js 依赖并构建前端
npm install
npm run build

# 启动本地 HTTP 服务器
python serve.py
```

4. 浏览器打开 `http://127.0.0.1:5173`
5. 浏览器地址栏右侧会出现"安装"图标 → 点击安装为独立 PWA 应用 → 钉到任务栏

每次使用时，先运行 `python serve.py` 启动服务器，然后打开 PWA 应用。

---

## 方式三：从源码运行桌面版

适合开发者，需要 Python 环境。

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/linhuanwen/work-tracker-pwa.git
cd work-tracker-pwa

# 2. 安装 Node.js 依赖并构建前端
npm install
npm run build

# 3. 安装 Python 依赖
pip install pywebview pystray Pillow python-docx requests

# 4. 启动桌面启动器
python launcher.py --debug
```

---

## AI 润色功能（可选）

AI 润色是可选功能，用于自动润色周/月/年小结的语言表达。

### 配置步骤

1. 在 `scripts/` 目录下复制 `.env.example` 为 `.env`
2. 编辑 `.env`，填入你的 API 密钥：

```env
# DeepSeek（推荐，便宜好用）
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AI_ENDPOINT=https://api.deepseek.com
AI_MODEL=deepseek-chat

# 或者通义千问（阿里云 DashScope）
#AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#AI_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
#AI_MODEL=qwen-turbo
```

3. 在应用"设置 → AI 配置"中填入 API 信息，或直接在 `.env` 中配置
4. 在周报/月报/年报页面点击"AI 润色"按钮

### 依赖

```bash
pip install requests
```

### 命令行用法

```bash
python scripts/polish.py path/to/data.json
```

---

## 跨设备同步

### WPS 云文档方案

1. 在 WPS 云文档中创建 `工作清单` 文件夹
2. 首次运行应用时，选择该文件夹作为数据目录
3. 其他设备上也登录同一 WPS 账号，WPS 自动同步
4. 手机/其他电脑上可用 PWA 模式访问同一数据文件

### 其他云盘方案

支持的云同步工具：OneDrive、坚果云、Dropbox、iCloud 等。
只要把 `data.json` 放在云同步文件夹中即可。

---

## 文件结构

```
工作清单/
├── 工作清单.exe         ← 桌面启动器（双击运行）
├── data.json           ← 数据文件（所有任务、项目、小结都在这里）
└── wjl-config.txt      ← 配置文件（可选，指定数据文件路径）
```

---

## 常见问题

### Q: 双击 exe 没反应？
A: 检查系统是否安装了 WebView2 Runtime。Windows 11 已内置；Windows 10 可能需要手动安装：https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Q: 如何备份数据？
A: 备份 `data.json` 文件即可，所有数据都在里面。

### Q: 如何迁移到新电脑？
A: 复制 `工作清单.exe` 和 `data.json` 到新电脑，放在同一文件夹即可。或用云同步自动迁移。

### Q: 如何卸载？
A: 直接删除 `工作清单.exe` 和 `data.json` 即可。没有注册表写入，没有残留文件。
