# 项目优化清理路线图

**Created:** 2026-08-25
**Status:** 进行中

---

## 当前项目状态

- 功能已基本完整：任务、子任务、项目、周/月/年小结、AI 润色、数据迁移、桌面快捷方式。
- 架构已收敛：React PWA + Python launcher 包；数据统一为 `data.json`。
- 测试基线：
  - 前端 `vitest`：39 文件 / 610 测试
  - Python：79 测试
  - `tsc` 0 错误

## 已完成清理

- [x] 删除桌面旧 `工作清单.exe`，保留桌面快捷方式 `工作清单.lnk`
- [x] 快捷方式指向 `release/工作清单/工作清单.exe`
- [x] exe 图标从被 ignore 的 `build/` 移到 `assets/工作清单.ico`，并纳入版本管理
- [x] 清理 `__pycache__`、`.pytest_cache`、`tsconfig.tsbuildinfo`、旧 `build/` 残留
- [x] 打包瘦身：`launcher.spec` 排除 `numpy/scipy/pandas`，exe 从 82M 降到 31M
- [x] 发布流程脚本化：`python scripts/build_release.py` 一条命令出包
- [x] release 压缩包排除本地运行状态文件（如 `.wjl-state.json`）
- [x] 引入 ESLint + Prettier，前端格式统一
- [x] 引入 Ruff，Python 静态检查通过
- [x] 新增 `python scripts/check_all.py` 统一质量门禁

## 已完成（本阶段）

- [x] P0 提交整理：当前工作区已整理为多个干净提交
- [x] P1 前端 ESLint + Prettier 接入
- [x] P1 Python Ruff 接入
- [x] P1 本地质量门禁 check_all.py
- [x] P2 测试补强：数据迁移合并冲突、快捷方式转义等边界用例
- [x] P2 子任务行内展示截止/优先级标签

## 后续优化候选

| 优先级 | 项目               | 说明                                                                                                |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------- |
| P0     | 提交整理           | 当前工作区有 launcher 包迁移、fs 数据层、子任务/迁移/快捷方式等大批未提交改动，建议先整理成干净提交 |
| P1     | 前端 lint/format   | 引入 ESLint + Prettier，统一代码风格                                                                |
| P1     | Python lint/format | 引入 Ruff，统一 Python 风格                                                                         |
| P1     | 构建脚本 CI        | 把 `build_release.py` 接进本地 CI/脚本，确保出包可重复                                              |
| P2     | 测试补强           | 导入合并边界、损坏数据恢复、桌面快捷方式真实环境 smoke test                                         |
| P2     | 体验优化           | 移动端响应式、PWA 离线冲突提示、子任务卡片展示更多元信息                                            |
| P3     | 后端导入导出接口   | 可选：桌面端直接指定路径导出/导入                                                                   |

## Ticket 映射

| Ticket                        | GitHub                                                          | 状态      |
| ----------------------------- | --------------------------------------------------------------- | --------- |
| C1 发布流程脚本化             | [#18](https://github.com/linhuanwen/work-tracker-pwa/issues/18) | ✅ 已实现 |
| C2 代码质量门禁与本地检查脚本 | [#19](https://github.com/linhuanwen/work-tracker-pwa/issues/19) | ✅ 已实现 |
| C3 边界测试补强               | [#20](https://github.com/linhuanwen/work-tracker-pwa/issues/20) | ✅ 已实现 |
| C4 子任务行内元信息           | [#21](https://github.com/linhuanwen/work-tracker-pwa/issues/21) | ✅ 已实现 |
