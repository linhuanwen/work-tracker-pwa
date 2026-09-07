# Spec: 总结模板引擎（Summary Template Engine）

> 编号 0002 · 基于 [guaguaguaxia/weekly_report](https://github.com/guaguaguaxia/weekly_report)（3.2k★，模板 = `{id, name, sections, category, tags}` 可插拔对象）与 SmartBrief 的模板思想，为 0001 的"周小结（四段式模板）/月小结/年度报告"建立一套**数据驱动的模板格式**。
> 状态：评审定稿（含子任务纳入总结的补充需求，见「AutoFill 配方注册表」与「归档数据模型」两节）。实施前仍可提出修改。

### 落地状态追踪（E1–E4 暂停期，2026-09）

模板引擎（Phase A–D = tickets E1–E4）暂缓开工；**「子任务纳入总结」已按本稿评审定稿规则作为直接改动先行落地**（随桌面客户端更新发布），要点：

- `SubTask.completedDate` 字段 + 写/清语义（勾选 done 记当天、撤销清空）已进 `types.ts` / `taskUtils.ts`；`DATA_VERSION` 仍为 1（可选字段，旧数据无需迁移，Phase B 迁移只做可选性说明即可）。
- 周报「本周完成任务」分类分组语义扩容（整单完成括注 `（完成子任务 n 项）`、推进中父任务以 `【推进中】（x/y 已完成）` 父行 + 周期内子行挂所属分类）；月报「项目进度回顾」更名「任务/项目推进」（字段键 `projectReview` 不变），量化汇总末尾追加"本月完成子任务 n 项（跨 m 个任务）"；年报维度要点整单完成展开全部完成子任务标题、推进中父任务单列（按年度归因）。归因回退规则同「呈现规则」表。
- **呈现规则 v2（2026-09-07 用户定稿，取代 v1 的"子任务按期归因"）**：子任务**打勾即视为完成**——不依赖 `completedDate`、也不要求父任务先改到「进行中」（待办/进行中均展示）。父行 x/y = 父任务当前全部已勾数；子行 = **全部已勾子任务标题**（不做周期/年份过滤，快照式——未整单完成父任务存续期间每期总结都会出现）。背景：旧客户端时期勾选的数据无 `completedDate`，按 v1 归因在周/月报中不可见；且用户习惯不改父任务状态。保留项：
  1. 整单完成任务桶不变（周/月括注计数不展开、年报展开；无日期子任务随父任务整单完成回退计数）。
  2. 项目推进段（周 Section 2 / 月 Section 2 项目部分）仍按 `completedDate` 按期归因算 `% → %` 进度（`%` 语义必须有周期边界；无项目子任务旧数据场景，Phase B 再评估快照式）。
  3. 月报量化尾行"本月完成子任务 n 项"仍按真实日期统计——"本月完成"是日期语义，无日期子任务不冒充本月（其完成情况已由 Section 2 父行 x/y 承载）。
  4. 年报 progressRows 按"任务在目标年份存续"过滤（`createdDate` ≤ 年末），子任务不做年份归因。
- 与冻结设计的**已知差异**（Phase B/C 落地时再评估）：
  1. `entry.tasks` 仍只收整单完成的任务 id，未按配方规则并入推进中父任务 id —— 保持"已完成任务"列表语义与数据安全；配方 taskIds 并集规则留给 v2 归档按 templateId 桶化时再定。
  2. 年量化行未追加"全年完成子任务 n 项"计数（该段没有任务级量化行可挂）；计数口径由周/月统计行与年度维度展开承担。
  3. 原「呈现规则」表中"周/月子行仅列周期内完成标题、旧数据无日期不强行归因"等句已被 v2 取代（见上）。

## Problem Statement

现有周/月/年总结的三套章节结构硬编码在三个页面组件里（`WeeklySummary.tsx` / `MonthlySummary.tsx` / `YearlyReport.tsx`），表现为：

1. **章节元数据散落**：每页各自维护章节标题、存储字段 key、空态文案、AI 润色开关，三者字段命名规则不统一（周 `doneTasks`、月 `quantitativeSummary`、年 `personnelAllocation`…）。
2. **无法切换汇报口径**：所有用户都只能用固定的"四段式"周报。遇到 OA 上报、通用场景需要精简口径时无法切换，而 0001 规格（"可配置：…prompt 模板（预设正式工作报告文风模板）"）本身就预留了多模板意图。
3. **Word 生成与复制逻辑各写一遍**：三个页面各有一段几乎相同的 `/api/summary` fetch 代码，只是 `sections` 的拼装来源不同；`Reports.tsx` 还留着一份占位章节（注释 `Placeholder content – will be replaced by actual report templates in #9 / #10`）。
4. **"章节→数据来源"没有显式关系**：哪一节可以"从任务数据一键生成"、由哪个 util 生成，只存在于页面组件内联逻辑里，不可被其他模板复用。

目标：把"一套总结的结构"提升为**一等公民——SummaryTemplate**。模板决定：适用周期、章节列表与顺序、每节的可编辑/可自动填充属性、空态文案；页面、归档、Word 生成、复制全部由模板驱动；每个周期可有多套预设模板且切换不丢历史内容。

## Non-Goals（本期不做）

- ❌ 用户自定义模板编辑 UI（自定义模板要求模板实例随 data.json 同步与 schema 校验，后续版本单独立项）。本期模板一律为**内置 preset**，随应用版本演进。
- ❌ 模板级 AI 文风切换（`aiStyle`）。全文保持 0001 单一"正式、简洁、数据说话"文风约束，避免口径漂移；模板只改结构不改文风。
- ❌ 模板使用统计（`useCount`）、分类标签体系、模板市场。

## Solution

### 概念模型

```
SummaryTemplate（静态定义，代码内置，不进 data.json）
  ├── periodType        适用周期 week | month | year
  ├── id/name/description
  └── sections[]        有序章节定义
        ├── key           归档存储字段名（稳定，历史兼容）
        ├── title         界面标题 & Word 文档二级标题
        ├── kind          'manual' 手写 | 'auto' 可由任务数据生成草稿
        ├── fill?         kind=auto 时引用 AutoFill 配方 id
        └── placeholder   空态提示文案

AutoFillRecipe（配方注册表，代码内置）
  └── (data, periodKey) => { text, taskIds? }   —— 复用现有 weeklyUtils/monthlyUtils/yearlyUtils

data.json（运行期）
  archives.{weeks|months|years}[periodKey][templateId] → SummaryEntry
  settings.summaryTemplateIds[period] → 当前活动模板 id
```

一次"生成/编辑/导出"的完整路径：

```
选定 (periodKey, templateId)
  → 模板 sections 决定页面渲染哪几节、每节是手写还是可自动填充
  → 「从任务数据生成」只填充 kind=auto 的章节（按 fill 找配方）
  → 用户逐节编辑，contentEditable 失焦写回 summary[key]（含 AI 润色，逻辑不变）
  → 「生成总结文档」由模板统一构建 sections{title: content} POST /api/summary
  → Python 侧保持不变：AI 重写 → Markdown → docx
```

### 模板 Schema

```ts
// ============================================================
// src/summaryTemplates/types.ts
// ============================================================

export type PeriodType = 'week' | 'month' | 'year';

/** 内置模板注册表中的条目 */
export interface SummaryTemplate {
  /** 稳定 id，命名 <period>-<variant>，如 'week-default'、'week-oa'。一旦发布不可改名（归档按它分桶）。 */
  id: string;
  periodType: PeriodType;
  name: string; // '工作周报'
  description: string;
  /** 模板默认章节标题前缀，Word 一级标题用，缺省 = 周期名（现状行为） */
  docPrefix?: string;
  sections: SummarySection[];
}

/** 章节：模板的最小结构单元，一份归档内容 = sections 的 key→文本 快照 */
export interface SummarySection {
  /** 归档存储字段，camelCase；沿用现有字段名保证 v1 数据零丢失 */
  key: string;
  title: string; // 界面与 Word "## 标题"
  /** manual = 人工撰写（可 AI 润色）；auto = 可从任务数据一键生成草稿后人工修改 */
  kind: 'manual' | 'auto';
  /** kind='auto' 时引用配方 id（见 summaryRecipes.ts），缺省则无一键生成能力 */
  fill?: string;
  placeholder: string; // 空章节引导文案
  singleLine?: boolean; // 单行输入（如"一句话总结"）
}

/** AutoFill 配方：把任务/项目数据转成某章节的草稿文本 */
export interface AutoFillContext {
  data: DataJson;
  periodKey: string; // '2026-W36' | '2026-09' | '2026'
}
export interface AutoFillResult {
  text: string; // 生成内容（空则用 placeholder）
  taskIds?: string[]; // 该章节消费的任务 id（并入 entry.tasks 的并集）
}
export type AutoFillRecipe = (ctx: AutoFillContext) => AutoFillResult;
```

约束（运行时由 `validateSummaryTemplates()` 校验，测试锁定）：

- 同一模板内 `key` 唯一、`sections` 非空；
- `fill` 必须指向已注册配方；同周期模板允许共享配方；
- `id` 全局唯一且匹配 `^(week|month|year)-[a-z0-9-]+$`；
- 每个周期必须有且仅有一个 `default: true` 的模板（迁移兜底用）。

### 预设模板注册表（首版 6 套）

静态常量文件 `src/summaryTemplates/presets.ts` + 选择器 `listSummaryTemplates(period)` / `getSummaryTemplate(id)` / `getDefaultTemplate(period)`。

#### week — 周报（2 套）

**week-default「工作周报」**（`default`；结构 = 现状，keys 不变 → v1 数据无缝）

| key             | title        | kind | fill                     | placeholder              |
| --------------- | ------------ | ---- | ------------------------ | ------------------------ |
| doneTasks       | 本周完成任务 | auto | week.completedByCategory | （本周无完成任务）       |
| projectProgress | 长期项目推进 | auto | week.projectProgress     | （本周无项目子任务推进） |
| nextWeekPlan    | 下周计划     | auto | week.planCandidates      | （暂无待办任务）         |
| blockers        | 需协调事项   | auto | week.blockers            | （无需协调事项）         |

**week-oa「通用周报」**（供 OA/通用口径上报；参考 guaguaguaxia `general_weekly` 精简）

| key          | title          | kind   | fill                     | placeholder         |
| ------------ | -------------- | ------ | ------------------------ | ------------------- |
| doneTasks    | 本周工作内容   | auto   | week.completedByCategory | （本周无完成任务）  |
| highlights   | 工作成果与亮点 | manual | —                        | 记录成果、亮点数据… |
| nextWeekPlan | 下周计划       | auto   | week.planCandidates      | （暂无待办任务）    |

#### month — 月报（2 套）

**month-default「月度总结」**（`default`；= 现状）

| key                 | title         | kind   | fill                  | placeholder                    |
| ------------------- | ------------- | ------ | --------------------- | ------------------------------ |
| quantitativeSummary | 量化汇总表    | auto   | month.quantified      | （本月无量化产出）             |
| projectReview       | 任务/项目推进 | auto   | month.projectProgress | （本月无任务或项目子任务推进） |
| reflection          | 月度反思      | manual | —                     | 记录本月做得好/待改进…         |
| nextMonthFocus      | 下月重点      | manual | —                     | 记录下月工作重点…              |

> 评审变更：「项目进度回顾」更名扩容为「任务/项目推进」（沿用 `projectReview` 键），内容 = 项目推进 + 非项目推进中任务的子任务推进（见「AutoFill 配方注册表」呈现规则）。旧月份数据仍在该字段下，仅标题语义更新。

**month-oa「通用月度总结」**

| key                 | title      | kind   | fill             | placeholder                   |
| ------------------- | ---------- | ------ | ---------------- | ----------------------------- |
| quantitativeSummary | 量化成果   | auto   | month.quantified | （本月无量化产出）            |
| mainWork            | 主要工作   | manual | —                | 按模块或项目归纳本月主要工作… |
| problems            | 问题与对策 | manual | —                | 记录问题与改进措施…           |
| nextMonthFocus      | 下月计划   | manual | —                | 记录下月计划…                 |

#### year — 年报（2 套）

**year-default「年度总结」**（`default`；= 现状 6 维度 + 一句话总结。字段名沿用 v1 的 camelCase）

| key                 | title                | kind   | fill             | placeholder            |
| ------------------- | -------------------- | ------ | ---------------- | ---------------------- |
| personnelAllocation | 日常工作             | auto   | year.byDimension | （该维度暂无任务记录） |
| internalRecruitment | 项目推进 | auto   | year.byDimension | 同上                   |
| rewardDiscipline    | 奖惩管理             | auto   | year.byDimension | 同上                   |
| performance         | 绩效管理             | auto   | year.byDimension | 同上                   |
| laborRelations      | 劳动关系             | auto   | year.byDimension | 同上                   |
| leaderAssigned      | 交办事项             | auto   | year.byDimension | 同上                   |
| other               | 一句话总结           | manual | —                | 一句话概括全年工作…    |

注：`other` 语义从 v1 即"一句话总结"（见 `YearlyReport.tsx` 的 `saveOneLiner` / `autoOneLiner` 逻辑），本期不改语义。

**year-oa「通用年度总结」**（供述职/评审之外的通用场景）

| key          | title        | kind   | fill             | placeholder          |
| ------------ | ------------ | ------ | ---------------- | -------------------- |
| mainWork     | 年度主要工作 | auto   | year.byDimension | （本年暂无完成任务） |
| achievements | 量化产出     | auto   | year.quantified  | （本年无量化产出）   |
| problems     | 不足与改进   | manual | —                | 记录不足与改进计划…  |
| nextYearPlan | 明年计划     | manual | —                | 记录明年重点计划…    |

> 参考 guaguaguaxia 的 `hr_weekly`（招聘进展/培训发展/行政事务/员工关怀/下周重点）可作为后续 week 的第三套 preset 候选，本期不引入，避免预设泛滥。

### AutoFill 配方注册表

配方统一收敛到一个新模块 `src/summaryTemplates/summaryRecipes.ts`，把**现在散落在三个页面组件里的一键生成内联逻辑**下沉为可注册函数；已存在于 utils 的纯函数直接复用，不在配方里重写。

### 呈现规则（评审定稿）：父任务为主体、子任务为进度说明

子任务被建模为**父任务的具体进度安排**，总结以父任务为行主体，完成子任务悬挂其下：

| 场景                                 | 周/月报                                                                         | 年报                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 父任务本周期**整单完成**             | 单行列出：`- title（完成子任务 n 项）`，不展开子行                              | 单行 + **逐条展开**该任务全部完成子任务标题（述职要明细） |
| 父任务**进行中**但本周期有子任务完成 | 主行 `- 【推进中】title（x/y 已完成）` + 子行逐条列出**周期内完成**的子任务标题 | 同样逐条展开（按年度归因），且计入维度要点                |
| 无子任务或本周期无推进               | 现状行为不变（只统计整单完成）                                                  | 现状行为不变                                              |

- 进度比例 `x/y` 为完成子任务数 / 总子任务数；周/月子行只列周期内新完成的（其余折叠为计数），年报子行列全部。
- 「本周完成任务」的分类分组语义随之扩容为"本周完成任务与推进"：整单完成的任务 + 有子任务推进的进行中父任务都出现在其所属分类分组下（推进条目带 `【推进中】` 前缀）。
- 周期归因不再使用"父任务整单完成才计入子任务"的启发式，改用**子任务真实完成日期**过滤，跨周/月推进不再漏报。

### 配方注册表

| 配方 id                  | 生成内容                                                                                       | 数据来源（现状/迁移）                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| week.completedByCategory | 本周完成任务与推进（分类分组，含推进中父任务 + 周期内完成子任务子行）                          | `weeklyUtils.getCompletedTasksByCategory` + `formatQuantityText`；新增进行中任务推进查询；`WeeklySummary.tsx:47` 内联排版下沉 |
| week.projectProgress     | 长期项目推进（项目级 X→Y% + 周期内完成子任务子行，真实日期归因）                               | `weeklyUtils.getProjectProgressChanges`（改为按子任务日期归因，父任务无需整单完成）                                           |
| week.planCandidates      | 下周计划                                                                                       | `weeklyUtils.getNextWeekPlanCandidates`                                                                                       |
| week.blockers            | 需协调事项                                                                                     | `weeklyUtils.getCoordinationItems`                                                                                            |
| month.quantified         | 量化汇总表；末尾追加"本月完成子任务 n 项（跨 m 个任务）"                                       | `MonthlySummary.tsx` 量化生成 + `monthlyUtils.aggregateMonthlyQuantities`                                                     |
| month.projectProgress    | 任务/项目推进：项目推进（日期归因）+ 非项目推进中任务（父行 + 周期内完成子任务子行）           | `monthlyUtils.getMonthlyProjectProgress`（日期归因改造）+ 新增非项目任务查询                                                  |
| year.byDimension         | 六维度归纳：各维度整单完成要点 + 展开子任务明细；推进中父任务单列（父行 + 年度完成子任务子行） | `yearlyUtils.getYearlyTasksByDimension` + `mapCategoryToDimension`（维度查询扩展）                                            |
| year.quantified          | 全年量化聚合；末尾追加"全年完成子任务 n 项"                                                    | 新增全年聚合（复用按月量化函数）                                                                                              |

> 评审变更：配方语义从"完成任务"扩为"完成任务与子任务推进"。为此须给 `SubTask` 增加完成日期追踪，见「归档数据模型与迁移」第 3 条。

页面行为约定：

- 页面级「从任务数据生成」按钮遍历当前模板 `kind='auto'` 的章节逐一执行配方并**覆写这些章节**；`kind='manual'` 章节一律不动（月报现状已如此，周报从"全量覆盖"收敛为"只覆盖 auto 节"，避免误删手写内容）。
- 所有配方返回的 `taskIds` 取并集写入 `entry.tasks`（含推进中父任务 id）。
- 空数据时配方返回 `placeholder` 文案（现有 `（本周无完成任务）` 等即 placeholder 的实值）。

### 归档数据模型与迁移（DATA_VERSION 1 → 2）

**决策：同一 (periodKey, templateId) 一份内容；不同模板的内容并存不互迁。**

原因：切换模板不应导致已沉淀内容丢失或语义错配。`summary[key]` 由模板的 `key` 集定义，跨模板转写必然产生"同名保留、异名丢弃"，对周/月/年这类会反复回看的历史档案不可接受。代价是周期导航多一个"当前查看哪套模板"维度（见下节），由页面右上角模板切换器承担，不新增导航层。

v1 数据形态（现状）：

```jsonc
{
  "archives": {
    "weeks": {
      "2026-W36": {
        "tasks": ["t1"],
        "summary": {
          "doneTasks": "…",
          "projectProgress": "…",
          "nextWeekPlan": "…",
          "blockers": "…",
        },
        "aiPolished": false,
      },
    },
  },
}
```

v2 数据形态（目标）：

```jsonc
{
  "archives": {
    "weeks": {
      "2026-W36": {
        "week-default": {
          // ← 迁移时包进周期默认模板 id
          "tasks": ["t1"],
          "summary": {
            "doneTasks": "…",
            "projectProgress": "…",
            "nextWeekPlan": "…",
            "blockers": "…",
          },
          "aiPolished": false,
        },
      },
    },
  },
}
```

类型与迁移变更：

```ts
// types.ts v2
export interface SummaryEntry {
  tasks: string[]; // 语义不变
  summary: Record<string, string>; // 不再按周期硬编码字段 → 由模板 key 集解释
  aiPolished: boolean;
}
export type SummaryTemplateId = string;
export interface Archive {
  // 每层加 templateId 分桶
  weeks: Record<string, Record<SummaryTemplateId, SummaryEntry>>;
  months: Record<string, Record<SummaryTemplateId, SummaryEntry>>;
  years: Record<string, Record<SummaryTemplateId, SummaryEntry>>;
}
export interface Settings {
  // …既有字段不变…
  summaryTemplateIds: { week: string; month: string; year: string }; // 活动模板
}

// 迁移：migrateDataJson 增加 v1→v2 分支
//   对 archives.{weeks|months|years} 每个 key：
//     值不是 "Record<templateId, entry>"（无模板层）→ 包成
//     { [getDefaultTemplate(period).id]: entry }，逐字段保留原样
// 校验：validateDataJson 放宽 summary 字段校验为 Record<string,string>；
//      templateId 分桶 key 非空即可（未知模板 id 由 UI 层回退默认模板，不判数据损坏）

// 评审补充第 3 条：SubTask 完成日期追踪（子任务纳入总结的前提）
//   interface SubTask { …, completedDate?: string | null }   // 可选，ISO date
//   写入：勾选 done → 记当天（与 task.completedDate 同语义）；done 撤销回 todo → 清空；
//         updateSubtask 的 patch.status 变更路径同样处理（TaskEditPanel 也走该路径）
//   校验：completedDate 可选 string|null；normalize 兜底同 Task
//   迁移回填（决定旧数据可归因性）：v1→v2 时，status='done' 且无 completedDate 的
//     子任务：若父任务 status='done' 且 completedDate 有值 → 回填父任务完成日期
//     （子任务必不晚于父任务完成）；否则留 null（无法追溯，不计入任何周期统计）
```

**兼容性要点**：`DATA_VERSION` 自增到 2；v1→v2 迁移是纯包装、无字段语义变化；后端 `launcher/` 不读 `archives`（AI 词文档只收前端拼好的 sections），Python 侧零改动；`launcher/tests`、迁移测试按既有 `T4_settingsDataMigration` 模式补齐。

### 运行期行为约定

1. **活动模板**：`settings.summaryTemplateIds`（随 data.json 云同步）。每周期一个活动模板 id；非法/缺失时回退该周期 default。设置页「AI 配置」旁新增「总结模板」选择区（周/月/年三个下拉）。
2. **页面切换**：周/月/年页顶栏放模板切换器（下拉，列出该周期全部 preset）。切换只改 `settings.summaryTemplateIds[period]`，并跳转到当前 periodKey × 新模板的内容槽；槽为空则显示空骨架（placeholder 引导 + 可一键生成）。
3. **历史导航**：上一周期/下一周期按钮跟随当前模板；目标周期在该模板下无 entry 时显示空骨架，不视为损坏。
4. **一键生成 / 逐节保存 / AI 润色**：逐节保存与润色交互保持现状（contentEditable/textarea + `/api/polish`），只是把硬编码章节表替换为 `template.sections` 渲染。
5. **Word 生成 / 复制**：抽取共用 `buildSummarySections(entry, template): Record<string, string>`（title→content，跳过空章节策略同现状），三页面与 `Reports.tsx` 的 `getSummaryPayload` 统一改用它；`Reports.tsx` 占位章节（`#9/#10` 注释处）改为按当前活动模板 + 任务数据兜底生成，占位模板删除。
6. **后端**：`/api/summary` 的 `sections` 载荷不变，`summary.py` 不做任何修改。模板切换、多模板并存对 Python 完全透明。
7. **年报特例**：`autoOneLiner`（本地自动生成一句话总结）是 year-default 的 year.byDimension 配方之外页面级能力，保留在 YearlyReport 适配层，不进模板 schema。

### 涉及文件清单

| 文件                                                                | 变更                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/summaryTemplates/types.ts`                                     | 新增：Schema                                                                                     |
| `src/summaryTemplates/presets.ts`                                   | 新增：6 套预设 + 选择器                                                                          |
| `src/summaryTemplates/summaryRecipes.ts`                            | 新增：配方注册表（从页面下沉）                                                                   |
| `src/types.ts`                                                      | v2：嵌套归档、SummaryEntry、settings.summaryTemplateIds、`SubTask.completedDate`、DATA_VERSION=2 |
| `src/taskUtils.ts` / `DataContext.tsx`                              | 子任务勾选/更新写入与清空 `completedDate`；archive actions 带 templateId；迁移调用链             |
| `src/WeeklySummary.tsx` / `MonthlySummary.tsx` / `YearlyReport.tsx` | 模板驱动渲染 + 共用生成/导出逻辑，删除内联章节定义；月报节标题「任务/项目推进」                  |
| `src/Reports.tsx`                                                   | 占位模板改为活动模板驱动                                                                         |
| `src/Settings.tsx`                                                  | 总结模板选择 UI                                                                                  |
| `src/weeklyUtils.ts` / `monthlyUtils.ts` / `yearlyUtils.ts`         | 新增周期内完成子任务过滤/推进中任务查询辅助；项目进度函数改为按子任务日期归因                    |
| 新增通用组件 `SummaryEditor.tsx`（若三页共享度高）                  | 模板渲染核心，三页作为"周期适配层"                                                               |
| `docs/specs/0001` / `README`                                        | 数据模型章节同步                                                                                 |

### 实施阶段（每阶段可独立评审/合入）

1. **Phase A — Schema 与注册表**：新增 summaryTemplates 三文件 + 校验与选择器单测；无 UI 变更。
2. **Phase B — 数据模型 v2 迁移**：types/validator/migrate v1→v2 包装 + 迁移测试；`DataContext` 保持向后兼容 API（调用处先传默认模板）。
3. **Phase C — 页面模板驱动化**：三页面把章节渲染、一键生成、Word 生成 payload 改为模板驱动（先只跑默认模板，行为应与现状等价 —— 用现有组件测试回归锁定）；删除各页内联章节常量。
4. **Phase D — 多模板与设置**：顶栏模板切换器 + Settings 默认模板选择 + 历史导航跟随模板；`Reports.tsx` 占位清理。

### 测试计划

- **单测**：模板校验（key 唯一、fill 存在、每周期恰一个 default）；presets 与 v1 字段名对照（确保迁移零丢失）；`buildSummarySections`；配方注册表逐一与 utils 结果快照。
- **日期归因单测**（子任务纳入总结的回归网）：进行中父任务的子任务跨周/月完成均正确归期；整单完成父任务子任务归期；done→todo 撤销后日期清空、不再计入；无 completedDate 的旧子任务不计入。
- **迁移测试**：v1 完整 fixtures（周/月/年各若干 entry）→ v2 包装断言；子任务完成日期**回填规则**用例（done 父任务带日期 → 子任务回填；done 父任务无日期 / 进行中父任务 → 留 null）；空 archives；手工损坏兜底（同 `T4_settingsDataMigration` 风格）。
- **组件测试回归**：三个总结页现有行为（生成/保存/润色/导出按钮）在默认模板下与改造前等价 —— 复用 `__tests__` 既有用例作为回归网。
- **后端**：无改动，`launcher/tests` 不新增（如 /api/summary 有契约测试则补一条"sections 含任意标题键"用例）。

## Testing Decisions（对齐 0001）

- 数据文件格式仍是唯一测试接缝；模板、配方、迁移都在 JSON Schema 之上单测。
- 模板预设与归档键的对照关系是**数据契约**，用单测锁定（防重构时改字段名导致 v1 数据读不出）。

## 开放问题

1. 周期页的"上一周/下一周"历史导航在模板切换后是否保留一套独立的"未填周期"骨架即可，还是需要"该周期在其它模板下有内容"的角标提示？（Phase D 细化）
2. 手机端 PWA 的小屏视图下，模板切换器放顶栏还是设置页（默认设置页，顶栏只放非默认标记）？
3. 后续若开放自定义模板：模板定义随 data.json 同步还是仅本机（localStorage）？倾向后者（避免 schema 校验与多设备冲突复杂化），但需与"内容跨设备可读"权衡 —— 见 Non-Goals 留待专项。
