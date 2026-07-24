# Functional Gap Fix Specification — 工作清单 (rili)

**Created:** 2026-07-23
**Source:** Data layer audit — 13 gaps found, 4 HIGH + 6 MEDIUM
**Status:** Draft → Execute after UI-IMPROVEMENT-SPEC

---

## 1. Overview

审计发现项目的 React PWA 层有 **4 个 HIGH severity 功能断头路**——代码已完整但路由/props/API 没接上，用户无法使用。另有 **6 个 MEDIUM** 功能缺失。这些是功能修复（feature completion），不是 UI 美化，应该排在 UI 9 票之后执行。

修复原则：**最小改动，接上线**。不改重构逻辑、不改类型定义，只补缺失的 props/路由/API 端点。

---

## 2. Design Principles

1. **接续而非重写** — 已有组件和 reducer 逻辑不变，只补连接点
2. **删除是破坏性操作要有二次确认** — 配合 UI Spec 的 ConfirmDialog
3. **Python 后端只做 API 桥接** — polish.py 不重写，只通过 endpoint 暴露

---

## 3. Tickets

### Ticket F1 — 接上删除任务功能

**What:** `DELETE_TASK` reducer 已就绪，但 `App.tsx` 没传 `onDeleteTask` prop 给 `TaskList`，导致删除按钮永远不出现。

**Files:**
- `src/App.tsx` — 给 `<TaskList>` 补传 `onDeleteTask` prop，调用 `dispatch({ type: 'DELETE_TASK', payload: id })`
- `src/TaskCard.tsx` — 确认 `onDelete` prop 与 `ConfirmDialog`（UI #2）的逻辑连通

**Acceptance:**
- 任务卡片上出现删除按钮（或右键菜单删除选项）
- 点击删除 → 弹出确认 → 确认后任务从列表消失并持久化到文件
- dateModified 时间戳更新

---

### Ticket F2 — 接上设置页路由

**What:** `Settings.tsx` 是 241 行完整组件，支持分类 CRUD 和周/月汇总日配置。但 `App.tsx` 没有 `/settings` 路由。

**Files:**
- `src/App.tsx` — 添加 `/settings` hash route，渲染 `<Settings>` 组件
- 导航入口 — 在 header nav pills 中添加"设置"按钮，或通过侧边栏（UI #7）进入

**Acceptance:**
- 访问 `#/settings` 进入设置页
- 分类增删改可用
- "每周汇总日"和"每月汇总日"下拉框可选择并持久化
- 从设置页可以导航回主页

---

### Ticket F3 — 接上休眠抽屉

**What:** `HibernateDrawer.tsx` 完整组件从未挂载。设置为跨年休眠的任务被 `filterHibernatingTasks()` 从活跃列表排除后就"消失"了，无处找回。

**Files:**
- `src/App.tsx` — 导入并渲染 `<HibernateDrawer>`，传入 hibernating 任务列表和 onActivate/onClose 回调
- 入口方式 — 在底部导航或顶部导航栏添加休眠入口按钮（带任务数量 badge）
- `src/DataContext.tsx` — 确认 `TRANSITION_STATUS` 或 `UPDATE_TASK` 可清除 `hibernateUntil` 和 `isCrossYear`

**Acceptance:**
- 存在入口按钮，显示休眠中任务数量
- 点击打开抽屉，显示所有 hibernating 任务
- 每个任务有"激活"按钮，点击后回到活跃列表
- 操作持久化到文件

---

### Ticket F4 — 接上 AI 润色 API

**What:** 周/月/年报汇总页各有"请求 AI 润色"按钮，点击后只显示 toast "已标记为待 AI 润色，等待本地脚本处理"。实际上 `scripts/polish.py` 是手动 CLI 工具，前端完全无法触发。

**Files:**
- `launcher.py` / `serve.py` — 新增 `POST /api/polish` 端点，接收 `{ archiveId, type, dataJsonPath }` 参数，调用 `polish.py` 作为子进程或内联执行
- `src/WeeklySummary.tsx` — `handleAiPolish` 改为发起 HTTP POST 到 `/api/polish`，显示 loading 状态
- `src/MonthlySummary.tsx` — 同上
- `src/YearlyReport.tsx` — 同上

**降级方案（如果 polish.py 太复杂）：** 直接把 AI 润色按钮改为"导出文本"，让用户在外部工具中润色后手动粘贴回来。比假按钮好。

**Acceptance:**
- 点击 AI 润色按钮后，按钮变为 loading 状态
- 成功后 archive 中该条目的 aiPolished 标记为 true
- 失败时显示错误 toast
- 不需要手动运行命令行脚本

---

### Ticket F5 — 接上 Reports 日报页

**What:** `Reports.tsx` 页面有周/月/年 Tab 切换、一键复制、CSV 导出功能。但无路由。

**Files:**
- `src/App.tsx` — 添加 `/reports` route，渲染 `<Reports>` 组件
- 导航入口 — header nav pills 或侧边栏加"报表"入口

**Acceptance:**
- 访问 `#/reports` 进入报表页
- "一键复制"将文本写入剪贴板并 toast 提示
- "导出 CSV"触发浏览器下载
- Tab 切换周/月/年正常工作

---

### Ticket F6 — 接上 BottomNav 底部导航

**What:** `BottomNav.tsx` 定义了完整的底部标签栏（任务/报表/设置/休眠），但从未在 App.tsx 中渲染。

**Files:**
- `src/App.tsx` — 渲染 `<BottomNav>` 并传入对应回调
- 与 UI #7 侧边栏的互斥逻辑 — 移动端用 BottomNav，桌面端用 Sidebar

**Acceptance:**
- 移动端视图底部显示 BottomNav
- 点击"任务"回到主页
- 点击"设置"跳转 `/settings`
- 休眠按钮显示数量 badge，点击打开 HibernateDrawer

---

### Ticket F7 — 接上删除项目功能

**What:** `DELETE_PROJECT` reducer 已定义，但 `ProjectsPage.tsx` 只有 Archive 按钮，没有 Delete 入口。

**Files:**
- `src/ProjectsPage.tsx` — 添加删除按钮 + `ConfirmDialog`，分发 `DELETE_PROJECT`
- 删除项目时，关联任务的处理策略 — 直接删除项目下的所有任务，或将其移到"未分类"

**Acceptance:**
- 项目卡片出现删除按钮
- 点击 → 弹出确认（提示"项目下 N 个任务将被一并删除"）→ 确认后删除
- 项目列表刷新，持久化到文件
- 不能删除已归档的项目（Archive 已足够）

---

## 4. 执行顺序

```
F1 (删除任务) ──┐
F2 (设置页)   ──┤  并行，都只改 App.tsx 的 props + routes
F3 (休眠抽屉) ──┤
                │
F6 (底部导航) ──┼── 依赖 F2、F3（需要设置和休眠入口存在）
                │
F5 (报表页)   ──┘  依赖 F6（Reports 可以是 BottomNav 的 tab）
                │
F7 (删除项目) ──┤  独立，只改 ProjectsPage
                │
F4 (AI 润色)  ──┘  独立，改 launcher.py + 汇总页
```

**推荐两轮并行:**
- 第 1 轮: F1、F2、F3、F7 并行（纯前端，4 个文件改动）
- 第 2 轮: F4、F5、F6 并行（F4 需 Python 改动，F5/F6 依赖第一轮）

---

## 5. TDD 输入词

### F1 — 接上删除任务
```
在 App.tsx 中给 TaskList 组件补传 onDeleteTask prop，dispatch DELETE_TASK action。确认 TaskCard 中删除按钮在收到 prop 后正确渲染，点击触发 ConfirmDialog 确认后执行删除。要求测试覆盖：删除 prop 传入后按钮可见、确认后 dispatch 被调用、取消后 dispatch 不被调用。
```

### F2 — 接上设置页路由
```
在 App.tsx 的 hash router 中添加 /settings 路由，渲染已有的 Settings 组件。在导航区域（header pills 或底部/侧边栏）添加设置入口按钮。要求测试覆盖：路由跳转正确渲染 Settings、分类 CRUD 操作正常、汇总日配置下拉框可交互。
```

### F3 — 接上休眠抽屉
```
在 App.tsx 中导入并渲染 HibernateDrawer 组件，传入 hibernating 任务列表和 onActivate 回调。在导航区域添加休眠入口按钮，显示休眠任务数量 badge。onActivate 回调清除任务的 hibernateUntil 和 isCrossYear 字段并写回数据。要求测试覆盖：抽屉打开/关闭、休眠任务列表渲染、激活按钮功能、badge 数量正确。
```

### F4 — 接上 AI 润色 API
```
在 launcher.py 中新增 POST /api/polish 端点，接收 archiveId 和 type 参数，调用 polish.py 的润色函数，返回润色后的文本。前端 WeeklySummary/MonthlySummary/YearlyReport 的 AI 润色按钮改为发起 HTTP 请求，按钮显示 loading 状态直到响应返回，成功后标记 aiPolished=true。要求测试覆盖：端点返回 200/错误码、前端 loading/成功/失败三种状态。
```

### F5 — 接上 Reports 报表页
```
在 App.tsx 中添加 /reports 路由，渲染已有的 Reports 组件。Reports 包含周报/月报/年报三个 Tab，每个 Tab 下有一键复制和 CSV 导出按钮。要求测试覆盖：Tab 切换正确、复制按钮将文本写入剪贴板、CSV 导出触发下载。
```

### F6 — 接上 BottomNav 底部导航
```
在 App.tsx 中渲染已有的 BottomNav 组件，传入 onNavigate/onOpenHibernate 等回调。注意与 UI 改进后的 Sidebar 的互斥逻辑——移动端断点（<768px）显示 BottomNav，桌面端显示 Sidebar。BottomNav 的休眠按钮显示 hibernating 任务数量 badge。要求测试覆盖：各 tab 点击导航正确、badge 数量、移动端/桌面端断点切换。
```

### F7 — 接上删除项目功能
```
在 ProjectsPage.tsx 中添加删除项目按钮，点击后弹出 ConfirmDialog 确认（提示项目下的任务数量），确认后 dispatch DELETE_PROJECT action。项目删除后其关联任务一并移除。要求测试覆盖：删除按钮渲染、确认弹窗内容、确认后 dispatch、取消后不 dispatch。
```

---

## 6. Acceptance Criteria Summary

- [ ] 任务卡片的删除按钮可用，确认后删除持久化
- [ ] `#/settings` 路由可访问，分类 CRUD 正常
- [ ] 休眠抽屉可打开，休眠任务可激活恢复
- [ ] AI 润色按钮可触发实际处理，不再只是 toast
- [ ] `#/reports` 路由可访问，CSV 导出可用
- [ ] 移动端底部导航栏渲染并导航正常
- [ ] 项目可删除，确认弹窗提示关联任务数量
- [ ] 所有 reducer action 都不再是死代码

---

## 7. Non-Goals

- 不改写 Reports 的 UI（它是功能页，无需美化）
- 不改写 polish.py 的润色算法
- 不合并三套 Python 后端（app.py/main.py/serve.py/launcher.py）
- 不添加新功能，只接上已有代码的断头路
