# 桌面快捷方式自动创建 Specification

**Created:** 2026-08-25
**Source:** 用户反馈“我都是点击桌面的工作清单.exe 进入”，希望应用像正常安装软件一样在桌面有一个可靠的快捷方式，而不用依赖把 exe 直接放在桌面上。
**Status:** Ready for Implementation

---

## Problem Statement

当前用户通过双击桌面上的 `工作清单.exe` 启动应用。exe 是一个 PyInstaller 打包的完整程序（需要与旁边 `_internal` 等配套文件一起存在），直接放在桌面并不优雅，也容易因为配套文件缺失而出错。用户希望应用能像常规桌面软件一样，在**第一次启动时自动在桌面创建一个指向 exe 的快捷方式**，从而可以把 exe 放到别的位置，平时仍然从桌面快捷方式进入。

## Solution

在桌面版启动器（非 headless、且是打包后的 exe）启动时，调用一个“确保桌面快捷方式存在”的模块：
- 若桌面已存在同名快捷方式（`工作清单.lnk`），**跳过不覆盖**（尊重用户自定义的图标/参数，不做侵入式修改）。
- 若不存在，则自动创建指向当前 exe 的快捷方式，并设置工作目录为 exe 所在目录、图标为 exe 自身。
- 非 Windows、或从源码直接运行（未打包、无 exe 路径）时不创建，静默返回。
- 创建失败不阻断启动（try/except 吞掉，仅 debug 模式打印日志），保证应用照常运行。

## User Stories

1. 作为用户，我希望首次启动应用后桌面自动出现“工作清单”快捷方式，这样我不需要手动把 exe 发送到桌面。
2. 作为用户，我希望同一个快捷方式如果我改过图标/名字，应用不会每次启动都覆盖它，这样我的自定义不被破坏。
3. 作为用户，我希望 exe 即使不在桌面上，桌面快捷方式也能正常启动，这样我能把程序放在更整洁的位置。
4. 作为用户，我希望快捷方式创建失败时应用仍能正常打开，这样不会因为环境问题导致无法使用。
5. 作为开发者，我希望在从源码运行或非 Windows 环境下不创建快捷方式，这样不会污染开发环境。

## Implementation Decisions

- **新增模块 `launcher/shortcut.py`**，职责单一：计算桌面路径、判断快捷方式是否已存在、通过 Windows 脚本宿主创建 `.lnk`。
- **创建快捷方式用 PowerShell + WScript.Shell 的 COM**（`New-Object -ComObject WScript.Shell`），不引入 pywin32，不改变打包依赖。
  - 通过 `subprocess.run` 执行 `powershell.exe -NoProfile -NonInteractive`，并加 `CREATE_NO_WINDOW` 标志避免弹出黑色控制台窗口。
  - 设置 `TargetPath = 当前 exe`、`WorkingDirectory = exe 目录`、`IconLocation = exe`、`WindowStyle` 常规。
- **桌面路径**优先用 Windows `SHGetKnownFolderPath(FOLDERID_Desktop)`，失败时回退到 `%USERPROFILE%/Desktop`。
- **存在性判断**：仅判断 `.lnk` 文件是否存在；存在即视为“已配置好”，跳过。
- **触发点**：`launcher/main.py` 的 `main()` 中、`--headless` 分支之后、创建窗口之前调用 `ensure_desktop_shortcut(debug=debug)`，放在后台线程或直接同步调用（首次才有 PowerShell，偶发一次可接受）。若担心启动延迟，可在后台 daemon 线程中调用；本实现采用后台线程，避免首次启动变慢。
- **失败静默**：整个模块任何异常都被捕获，仅 debug 打印，绝不抛出到主流程。
- **测试接缝**：
  - `is_frozen()`：判断 `sys.frozen`，可 monkeypatch。
  - `current_exe_path()`：返回 `sys.executable`（仅 frozen）。
  - `desktop_dir()`：返回桌面目录，可 monkeypatch（避免测试改动真实桌面）。
  - `shortcut_path(desktop)`：计算 `.lnk` 全路径。
  - `invoke_ps(script)`：真正跑 PowerShell 的薄层，测试中 monkeypatch 掉。
  - `create_shortcut(target, lnk)`：组装 PS 脚本并调用 `invoke_ps`，返回 bool。
  - `ensure_desktop_shortcut(debug)`：编排 + try/except，可测“已存在跳过 / 创建 / 失败静默”。

## Testing Decisions

- **只测外部行为与编排逻辑，不真正写桌面 / 不真的跑 PowerShell**（避免污染环境、避免跨平台失败）。
- 测试用 `monkeypatch`/`MagicMock` 替换：
  - `sys.frozen`/`sys.executable`
  - `shortcut.desktop_dir`
  - `shortcut.invoke_ps`（捕获生成的脚本，断言 TargetPath / WorkingDirectory 正确）
  - `Path.exists`
- 覆盖用例：
  - 非 frozen（源码运行）→ 不创建、返回 False
  - 快捷方式已存在 → 不重复创建、返回 True
  - 不存在 → 调用一次创建、且 PS 脚本含正确 target 与 working dir
  - invoke_ps 抛异常 → 被吞掉、返回 False、不阻断
  - 非 Windows 平台 → 返回 False 不创建
- 参照现有 `launcher/tests/test_win32.py`、`launcher/tests/conftest.py` 的约定。

## Out of Scope

- 不在“开始菜单”或“任务栏”创建快捷方式（本次仅桌面）。
- 不实现 exe 与配套文件的自动迁移/安装器；本次只在应用启动时创建快捷方式。
- 不做“已有快捷方式有指向旧 exe 时自动更新 target”的逻辑（尊重用户；若 target 失效由用户手动重建）。
- 不改动打包流程（PyInstaller 本身不负责建快捷方式）。

## Further Notes

- 桌面图标名固定为 `工作清单.lnk`，与 Windows 显示名一致。
- 该快捷方式只是“启动入口”，应用运行时需要的配套文件仍随 exe 位置存在；用户不应单独移动 exe 而不移动整个文件夹。
- 建议文档（README / INSTALL / USER-GUIDE）补充说明：首次启动会自动在桌面创建快捷方式，exe 可放在任意目录。

---

## Ticket Breakdown

| Ticket | 标题 | 内容 | 验收 |
|--------|------|------|------|
| S1 | 新增桌面快捷方式模块 shortcut.py | 计算桌面路径、存在性判断、PS-COM 创建 .lnk、编排 + 异常吞没 | 有单元测试，符合上述 Testing Decisions |
| S2 | 接入启动器 main() 并更新文档 | 在 main() 后台线程调用 ensure_desktop_shortcut；README/INSTALL/USER-GUIDE/tickets 补说明 | 启动器调用生效，文档更新 |

## Acceptance Criteria Summary

- [ ] 首次启动（打包 exe）自动在桌面生成 `工作清单.lnk`
- [ ] 快捷方式已存在时不重复创建/不覆盖用户自定义
- [ ] 从源码运行或非 Windows 时不创建
- [ ] 创建失败静默、不影响应用启动
- [ ] 文档已更新说明该行为
