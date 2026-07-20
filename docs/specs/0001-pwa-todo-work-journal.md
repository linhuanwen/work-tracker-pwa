# Spec: 工作清单 PWA（个人工作管理 & 自动小结）

## Problem Statement

作为国企人力资源经办人，我需要：

1. 管理每日工作任务（to-do list），用优先级和紧急区区分轻重缓急
2. 追踪长期项目的子任务推进，避免"一周下来好像啥都没干"
3. 每周/每月自动从日常记录生成工作小结汇报（含量化产出汇总）
4. 年底从全年记录生成年度总结，按人员配置、内部招聘、奖惩管理、劳动关系等维度归纳，支撑评优和晋升述职
5. 在公司电脑（只能上白名单网站、不能装任何软件、有远程监控）和个人安卓手机之间同步数据
6. 跨周/跨月的重要任务提醒，跨年任务可休眠至临近再激活

## Solution

一个 **React + Vite PWA**，运行在浏览器中，可安装为独立桌面窗口。数据存储在 WPS 云文档同步文件夹中的单一 JSON 文件，通过 WPS 自动在电脑和手机间同步。个人电脑上运行独立的 Python 脚本，读取同一 JSON 文件，调用 AI API 润色周报/月报/年报后写回。

### 架构概览

```
公司电脑                           WPS 云端                       个人电脑
───────                          ────────                       ────────
PWA (浏览器独立窗口)               WPS 服务器                    Python AI 润色脚本
    ↕                               ↕                              ↕
WPS 云文档文件夹  ◄──自动同步──►  data.json  ◄──自动同步──►  WPS 云文档文件夹
    ↕
安卓手机 WPS App → 手机 PWA（浏览器）
```

### 数据流

1. 你在公司电脑或手机上通过 PWA 管理任务（增删改查、标记完成）
2. PWA 读写 WPS 云文档文件夹里的 `data.json`
3. WPS 自动将更改同步到云端、再同步到其他设备
4. 到了周末/月末，在个人电脑上运行 Python 脚本 → 读取 `data.json` → 生成小结草稿 → 调用 AI API 润色 → 写回 `data.json`
5. 公司电脑 PWA 刷新即可看到润色结果，在此基础上手动编辑定稿

## User Stories

### 每日任务管理

1. 作为经办人，我想在桌面独立窗口看到我的任务清单，顶部有紧急区，下方按优先级排列，一目了然
2. 作为经办人，我想添加新任务时填写标题、分类、优先级、截止日期、量化产出指标、关联项目、备注
3. 作为经办人，我想把任务标记为紧急，紧急任务自动置顶到紧急区（最多 5 条），避免视觉过载
4. 作为经办人，我想勾选完成任务，已完成的任务显示为划线/淡化，仍可取消勾选恢复
5. 作为经办人，我想取消的任务能归档而非删除，保留完整记录
6. 作为经办人，我想随时拖拽或调整任务顺序，按当日需要重新排列轻重缓急
7. 作为经办人，我想看到每个长期父任务的子任务数量（如"8/12"进度条），知道推进了多少
8. 作为经办人，我想给"领导交办"类任务打特殊标记，记录交办来源、交办时间、完成时限

### 长期项目追踪

9. 作为经办人，我想创建"项目"作为父任务容器，下面建子任务追踪推进
10. 作为经办人，我想看到父任务根据子任务完成数量自动显示进度条，但最终完成需要手动确认
11. 作为经办人，我想在周报中看到长期项目的进度变化（从 X% → Y%），让推进感可见

### 周/月/年度小结

12. 作为经办人，我想每周五系统自动提醒生成周小结，无需记忆
13. 作为经办人，我想周小结自动拉入本周完成的任务（按分类排列），拉入下周待办，汇总阻塞事项
14. 作为经办人，我想在周小结"下周计划"中手动补充新任务，新任务自动回填到任务清单
15. 作为经办人，我想月小结自动汇总当月量化产出（各类别统计表）、长期项目进度回顾，并可手写反思和下月重点
16. 作为经办人，我想年度报告按人员配置、内部招聘（晋升晋等）、奖惩管理、绩效管理、劳动关系、领导交办等维度自动归纳，列出每个维度的关键业绩和工作量
17. 作为经办人，我想手动对年度报告的每个维度添加"关键业绩提炼"文字，体现深度

### AI 润色

18. 作为经办人，我想在个人电脑上运行一个 Python 脚本，自动读取 `data.json` 中待润色的小结，调用 AI API 润色语言后写回
19. 作为经办人，我想 AI 润色保持国企文风——正式、简洁、结构化；同时你可以控制是否启用 AI 润色
20. 作为经办人，我想 AI 润色后的结果仍可手动编辑，不完全依赖 AI 输出
21. 作为经办人，我想在年终时把年度小结草稿 + 上级单位年度人力工作计划一起交给 AI 做"对纲"分析，体现工作契合组织发展

### 提醒机制

22. 作为经办人，我想重要任务有截止倒计时提醒（如"距 X 项目截止还有 15 天"）
23. 作为经办人，我想跨周跨月的重要任务持续显示提醒，不被遗忘
24. 作为经办人，我想标记为"跨年"的任务可以设置休眠，在临近截止前 1-2 个月才出现，平时不占视觉空间

### 跨设备同步

25. 作为经办人，我想在公司电脑上改动任务后，手机上打开 PWA 就能看到最新状态
26. 作为经办人，我想 WPS 作为同步中转，不需要任何额外服务器或安装软件
27. 作为经办人，我想数据 JSON 文件在 WPS 云文档文件夹里，可以作为备份随时拷贝

### 数据导出

28. 作为经办人，我想周报内容一键复制为纯文本，方便粘贴到 OA 系统或邮件
29. 作为经办人，我想数据可以导出为 Excel，方便离线备份或发给别人
30. 作为经办人，我想年度报告有附表（月度趋势折线图、量化产出汇总表），供翻看记录时参考

### 配置

31. 作为经办人，我想要一个设置页面，可以管理分类列表（人员调配、内部招聘、奖惩管理、绩效管理、劳动关系、领导交办、其他）
32. 作为经办人，我想要设置页面可以配置周结日（默认周五）、月结日（默认每月28号）
33. 作为经办人，我想要事后补录功能——周/月归档后仍可编辑修改数据

### 数据安全

34. 作为经办人，我想数据存在自己的 WPS 云文档里，不经过任何第三方服务器（AI API 调用除外，且仅在我个人电脑上触发）
35. 作为经办人，我想公司电脑上只有 WPS Office（白名单办公软件）和浏览器打开 PWA，无任何额外进程，不会被远程监控标记

## Implementation Decisions

### 技术栈

- **前端**：React 18+ Vite + TypeScript
- **PWA**：vite-plugin-pwa（Workbox workbox-precaching + CacheFirst for static assets）
- **UI**：简洁风格，CSS Modules 或 Tailwind CSS，重点区域（紧急区）用高对比色突出
- **数据持久化**：浏览器 File System Access API 读写 WPS 云文档文件夹中的 `data.json`
- **状态管理**：React Context + useReducer；数据模型为单一 JSON 树，与 Vite 构建产物分离
- **Phone PWA**：同一套代码响应式布局，安卓浏览器打开后"添加到桌面"即可

### 数据模型

核心 JSON Schema（单文件 `data.json`）：

```
{
  version: number,
  lastModified: ISO8601 string,
  settings: {
    weeklySummaryDay: number (1-7, 1=周一),
    monthlySummaryDay: number (1-28),
    aiPolishFlag: boolean,
    categories: string[],
    annualPlan?: { year, sections: [{ title, source, goals[] }] }
  },
  projects: [{
    id: string,
    title: string,
    category: string,
    status: "in-progress" | "completed" | "archived",
    startDate: string (ISO date),
    targetDate: string (ISO date),
    notes: string,
    subtaskCount: { total: number, done: number }
  }],
  tasks: [{
    id: string,
    projectId: string | null,
    title: string,
    category: string,
    priority: "urgent" | "important" | "normal",
    status: "todo" | "in-progress" | "done" | "cancelled",
    createdDate: string,
    deadline: string | null,
    completedDate: string | null,
    quantities: [{ label: string, value: number, unit: string }],
    subtasks: [{ id: string, title: string, status: "todo" | "done" }],
    notes: string,
    isLeaderAssigned: boolean,
    leaderSource?: string,
    leaderAssignedDate?: string,
    leaderDeadline?: string,
    isCrossYear: boolean,
    hibernateUntil?: string (ISO date)
  }],
  archives: {
    weeks: { "2026-W29": { tasks: string[], summary: {...}, aiPolished: boolean } },
    months: { "2026-07": { tasks: string[], summary: {...}, aiPolished: boolean } },
    years: { "2026": { tasks: string[], summary: {...}, aiPolished: boolean } }
  }
}
```

### PWA 安装形态

- 桌面端：用户通过 Chrome/Edge 的"安装"功能将 PWA 安装为独立窗口（无地址栏、标签栏）
- 移动端：安卓浏览器打开 → 添加到桌面 → 图标启动，仿原生体验
- 离线：静态资源和已加载数据缓存，离线仍可查看（编辑需联网同步 WPS）

### 核心组件树

```
App
├── EmergencyZone          — 紧急区（最多5条，红色高亮）
│   └── TaskCard[]         — 可勾选完成、可拖拽排序
├── TaskList               — 常规任务区
│   ├── TaskGroup[urgent]  — 重要任务（黄色标记）
│   ├── TaskGroup[normal]  — 日常任务
│   └── TaskCard[]         — 含子任务进度条、量化产出标签
├── ProjectPanel           — 长期项目视图
│   └── ProjectCard[]      — 进度条 + 展开子任务
├── WeeklySummary          — 周小结（四段式模板）
├── MonthlySummary         — 月小结（量化汇总表 + 反思）
├── YearlySummary          — 年度报告（按维度归纳）
└── Settings               — 分类管理、结日配置
```

### 周报模板引擎

从任务数据填充四段式：
1. **本周完成任务** — 按 category 分组列出 `status=done` 且完成日在当周的任务
2. **长期项目推进** — 列出 `projectId` 非空的任务所在项目，显示进度变化
3. **下周计划** — 自动拉入 `status=todo` 且无 deadline 或 deadline 在未来的任务，支持手动增删（新增项自动写入 tasks）
4. **需协调事项** — 自动汇总 `status=in-progress` 且标记了阻塞原因的任务

### AI 润色脚本（Python，独立于 PWA）

- 脚本形态：单文件 `polish.py`，命令行运行
- 读取 `data.json`，找到标记为 `aiPolishFlag=true` 的周/月/年小节
- 调用 AI API（如 DeepSeek / 通义千问 API）进行语言润色
- 润色结果写回 JSON 的对应 summary 字段，`aiPolishFlag` 设为 `false`
- 可配置：API 端点、模型名、prompt 模板（预设"国企文风"模板）

### 跨年休眠机制

- `isCrossYear: true` 且 `hibernateUntil` 有值的任务，在 `hibernateUntil` 日期之前不出现在主列表
- 可在"休眠任务"抽屉中查看全部休眠任务
- `hibernateUntil` 到期当天自动激活回到主列表
- 默认休眠至截止日期前 60 天

## Testing Decisions

### 测试接缝

唯一测试边界是 **JSON 数据文件格式**。PWA 和 AI 脚本都只通过同一个 JSON Schema 读写数据。

### 测试策略

- **单元测试（Vitest）**：数据转换逻辑——任务过滤器、周报模板填充、量化产出汇总计算、进度条计算
- **组件测试（React Testing Library）**：关键交互——任务勾选完成、紧急区排序、设置页修改分类、周报编辑
- **集成测试**：File System Access API 读写 → 状态更新 → UI 渲染的完整链路
- **数据迁移测试**：JSON Schema 版本升级兼容性

### 说明

- 测试外部行为（如"标记完成任务后周报中的计数是否 +1"），不测试内部实现
- 不测试浏览器 PWA 安装行为（依赖浏览器自身）
- 不测试 WPS 同步（依赖 WPS 自有功能）
- AI 脚本测试：给定固定输入 JSON，断言输出 JSON 结构完整、字段不能丢失

## Out of Scope

- 多用户协作 / 团队任务管理
- 对接飞书/钉钉/企业微信等外部工作平台
- 服务器端部署（PWA 纯前端，零后端）
- AI 润色功能内嵌到 PWA（独立 Python 脚本，不在 PWA 中）
- 年度上级计划"对纲"功能内嵌（事后交给 AI 独立处理，不在 PWA 中）
- 通知推送（依赖系统级通知不可靠）
- iOS 支持（用户使用安卓手机）

## Further Notes

- 分类列表见项目实施时约定，可在设置页随时调整
- AI 润色默认"国企文风"——正式、简洁、结构化、避免口语化
- 跨年任务休眠的设计基于用户反馈：跨年事项平时不占视觉，临近再出现
- 后续迭代可通过 AGENTS.md 中的技能体系持续演进（如 bug-fix、feature 需求走 `/triage` → `/to-spec` 流程）
