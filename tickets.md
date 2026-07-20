# Tickets: PWA 工作清单 & 自动小结系统

从 [spec 0001](docs/specs/0001-pwa-todo-work-journal.md) 拆分的 9 个垂直切片。工作顺序沿依赖图从无阻塞的节点开始。

## 依赖图

```
#2 ──┬── #4 ──┬── #8 ──┬── #9 ── #10
     │        │        │
     ├── #7 ──┘        │
     ├── #5 ───────────┘
     └── #6

#3（独立）
```

## Ticket 映射

| Ticket | GitHub | 标题 | 阻塞于 |
|--------|--------|------|--------|
| 1 | [#2](https://github.com/linhuanwen/work-tracker-pwa/issues/2) | 项目脚手架 & 基础任务列表 | 无 |
| 9 | [#3](https://github.com/linhuanwen/work-tracker-pwa/issues/3) | Python AI 润色脚本 | 无 |
| 2 | [#4](https://github.com/linhuanwen/work-tracker-pwa/issues/4) | 完整任务生命周期 | #2 |
| 7 | [#5](https://github.com/linhuanwen/work-tracker-pwa/issues/5) | 设置、导出 & 跨年休眠 | #2 |
| 8 | [#6](https://github.com/linhuanwen/work-tracker-pwa/issues/6) | 移动端响应式 & PWA 打磨 | #2 |
| 3 | [#7](https://github.com/linhuanwen/work-tracker-pwa/issues/7) | 紧急区 & 任务增强 | #2 |
| 4 | [#8](https://github.com/linhuanwen/work-tracker-pwa/issues/8) | 子任务 & 项目 | #4 |
| 5 | [#9](https://github.com/linhuanwen/work-tracker-pwa/issues/9) | 周小结 | #4, #7, #8 |
| 6 | [#10](https://github.com/linhuanwen/work-tracker-pwa/issues/10) | 月小结 & 年度报告 | #9 |

## 实施顺序

**第一批（无阻塞，可并行）：** Ticket 1, Ticket 9

**第二批（等 #2 完成）：** Ticket 2, Ticket 3, Ticket 7, Ticket 8（四个可并行）

**第三批（等 #4 完成）：** Ticket 4

**第四批（等 #4 + #7 + #8 完成）：** Ticket 5

**第五批（等 #9 完成）：** Ticket 6
