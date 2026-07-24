# UI Improvement Specification — 工作清单 (rili)

**Created:** 2026-07-23
**Source:** Comparison analysis with [yuji-todo](https://github.com/denganjia/yuji-todo)
**Status:** Draft → Ready for Implementation

---

## 1. Overview

This spec defines a phased UI/UX improvement plan for the PWA work journal app. The reference project (yuji-todo) excels in: component library adoption, icon system, dark mode, sidebar layout, right-click context menus, delete confirmations, collapsible animations, and inline input actions. Our app has good bones (fluid typography, glass morphism tokens, touch-friendly targets) but needs professional polish.

## 2. Design Principles

1. **Desktop-first, mobile-adaptive** — The app runs in WebView2. Default to a sidebar layout on wide viewports, collapse to single-column on narrow.
2. **Icon professionalism** — Replace all emoji with SVG icons. Icons must render identically across Windows/macOS/iOS/Android.
3. **Dark mode is not optional** — The current glass design depends on a light wallpaper. Add a semi-opaque backdrop layer and dark color scheme.
4. **Confirmation before destruction** — Delete, archive, and irreversible actions must ask for confirmation.
5. **Progressive disclosure** — Hide completed/archived items behind a collapsible toggle with smooth animation.

## 3. Phase 0 — Quick Wins (1-2 hours)

### P0-1: Replace Emoji with SVG Icons

**What:** Install `lucide-react` and replace all emoji usage.

**Files affected:**
- `src/App.tsx` — navigation emoji (📋📅📊📁)
- `src/TaskCard.tsx` — status/priority indicators
- `src/UrgentZone.tsx` — arrow buttons (▲▼)
- `src/BottomNav.tsx` — tab icons
- `src/MonthlySummary.tsx`, `src/WeeklySummary.tsx`, `src/YearlyReport.tsx` — back arrow, AI polish, regenerate buttons
- `src/AddTaskForm.tsx` — `+` icon

**Mapping table:**

| Current Emoji | lucide-react Icon | Usage |
|---|---|---|
| 📋 | `ClipboardList` | Task list nav |
| 📅 | `Calendar` | Weekly nav |
| 📊 | `BarChart3` | Monthly/Yearly nav |
| 📁 | `FolderOpen` | Projects nav |
| 🔴 | `Circle` (filled) | Priority indicators |
| 🤖 | `Sparkles` | AI polish |
| ✨ | `Wand2` | AI actions |
| 🔄 | `RefreshCw` | Regenerate |
| ← → | `ChevronLeft` / `ChevronRight` | Navigation |
| ▲ ▼ | `ChevronUp` / `ChevronDown` | Reorder |
| + | `Plus` | Add task |
| ⚙️ | `Settings` | Settings tab |
| 💤 | `Moon` | Hibernate drawer |
| ⚠️ | `AlertTriangle` | Urgent zone |

**Acceptance:** Zero emoji in the DOM. All icons render as SVG. No visual difference across OS.

---

### P0-2: Delete Confirmation Dialog

**What:** Add a confirmation step before any task/project deletion.

**Design:**
```
┌─────────────────────────────────────┐
│  ⚠️  确认删除                         │
│                                     │
│  删除后无法恢复，确定要删除            │
│  「{task title}」吗？                 │
│                                     │
│         [取消]    [确认删除]          │
└─────────────────────────────────────┘
```

**Files:**
- `src/DataContext.tsx` — `deleteTask` should accept `{skipConfirm?: boolean}` option
- `src/TaskCard.tsx` — before calling `deleteTask`, show a `<dialog>` or custom modal
- `src/TaskEditPanel.tsx` — same for the delete button in the edit panel
- `src/ProjectsPage.tsx` — same for project deletion

**Implementation approach:** Create a reusable `<ConfirmDialog>` component with:
- `title`, `message`, `confirmLabel`, `danger?: boolean` props
- `<dialog>` element with `showModal()` API (native, no dependency)
- Glass morphism styling matching existing design tokens

**Acceptance:** Every delete action shows a confirmation. "取消" dismisses. "确认删除" executes. ESC dismisses.

---

## 4. Phase 1 — Visual Foundation (3-5 hours)

### P1-1: Dark Mode

**What:** Add theme toggle (light / dark / auto), with a background overlay for readability.

**Design tokens to add in `index.css`:**

```css
[data-theme="dark"] {
  --color-text: #e0e0e0;
  --color-text-secondary: #aaa;
  --color-text-muted: #777;
  --glass-bg-card: rgba(30, 30, 35, 0.65);
  --glass-bg-card-hover: rgba(40, 40, 48, 0.78);
  --glass-bg-input: rgba(40, 40, 48, 0.72);
  --glass-border: rgba(255,255,255,0.08);
  --glass-shadow: 1px 3px 12px rgba(0,0,0,0.25);
  /* ... */
}
```

**Background overlay:** Add a `<div class="theme-backdrop">` as the first child of `<body>`, styled:
- Light: `rgba(255,255,255,0.0)` (transparent, wallpaper shows)
- Dark: `rgba(0,0,0,0.45)` (dim the wallpaper for contrast)

**Settings UI:** Add a radio group in Settings page: `浅色 / 深色 / 跟随系统`. Persist to `localStorage`.

**Acceptance:** Switching to dark mode makes all text readable within 200ms. No hardcoded colors break.

---

### P1-2: Unify CSS Variables Usage

**What:** Replace all hardcoded hex values with CSS variable references.

**The rule:** Every color in a `.module.css` file MUST use `var(--color-*)` or `var(--glass-*)`. No raw hex values except in `index.css` `:root` / `[data-theme]` blocks.

**Audit command:**
```bash
rg '#[0-9a-fA-F]{3,6}' src/*.module.css
```

**Files with violations (from analysis):** 15+ CSS module files. Start with `App.module.css`, `TaskCard.module.css`, `Settings.module.css`, `AddTaskForm.module.css`.

**Acceptance:** Zero raw hex color values in `src/**/*.module.css`. Changing `--color-primary` in `index.css` changes the entire app's accent color.

---

### P1-3: Task Tag System

**What:** Extract priority/date/category meta into styled tag chips (like yuji-todo's `<n-tag>`).

**Design:**
```
┌──────────────────────────────────────────────┐
│  ● 完成项目报告                          ★   │
│  [🔴 紧急] [📁 项目A] [📅 7月25日截止]        │
│  创建于 7月20日                            ▼  │
└──────────────────────────────────────────────┘
```

**Implementation:**
- Create `src/Tag.tsx` + `src/Tag.module.css`
- Props: `variant: 'priority' | 'category' | 'date' | 'default'`, `color?: string`, `icon?: ReactNode`
- Use existing `--fs-tag` font size
- Priority tags get colored left border accent (matching existing UrgentZone pattern)
- Date tags show relative time ("今天", "明天", "7月25日")

**Acceptance:** Task cards show all metadata as consistent tag chips. Tags have proper contrast in both themes.

---

## 5. Phase 2 — Interaction Upgrades (5-8 hours)

### P2-1: Completed Tasks Collapse Animation

**What:** Replace the static archived section with an animated collapsible toggle.

**Design:**
```
已完成 5 ▸           ← click to expand
---
已完成 5 ▾           ← expanded state
  ✓ Task A
  ✓ Task B
  ...
```

**Implementation:**
- Use CSS `grid-template-rows: 0fr` → `1fr` transition on a wrapper div
- Or use a lightweight `<CollapseTransition>` component with `max-height` animation
- The toggle button shows count badge

**Files:** `src/TaskList.tsx`, `src/TaskList.module.css`

**Acceptance:** Expanding/collapsing shows a smooth 200ms transition. Completed count updates live.

---

### P2-2: Right-Click Context Menu

**What:** Add native right-click menu on task cards and project cards.

**Actions per context:**

| Context | Menu Items |
|---|---|
| Task card | 编辑 / 复制标题 / 切换状态 / ── / 删除 |
| Project card | 编辑 / ── / 删除 |
| Urgent zone | 移到重要 / 移到普通 |

**Implementation:**
- Create `src/ContextMenu.tsx` — portal-based, positioned at `{x, y}` from `onContextMenu` event
- Use existing glass design tokens
- `onClickOutside` dismisses
- Keyboard: ESC dismisses

**Acceptance:** Right-click shows menu at cursor. Click outside or ESC dismisses. Menu items are reachable via keyboard.

---

### P2-3: Custom Theme Color

**What:** Replace hardcoded `#4a6cf7` with a user-configurable primary color.

**Settings UI:**
```
主题色:  [🔵] [🟢] [🟠] [🟣] [自定义]
```

**Implementation:**
- Store `--color-primary` value in `localStorage`
- On change, set `document.documentElement.style.setProperty('--color-primary', newColor)`
- Compute hover/active variants with color manipulation (lighten/darken by 8-12%)
- Preset swatches: Blue `#4a6cf7`, Green `#18a058`, Orange `#f0a020`, Purple `#7c3aed`

**Acceptance:** Picking a new color immediately changes all accent elements. No page reload needed.

---

## 6. Phase 3 — Layout & Architecture (8-12 hours)

### P3-1: Desktop Sidebar Layout

**What:** On viewports ≥ 900px, show a persistent sidebar instead of the bottom nav.

**Layout:**
```
┌──────────┬──────────────────────────────────┐
│          │  Header (today's date + greeting)  │
│ Sidebar  ├──────────────────────────────────┤
│          │                                  │
│ 📋 任务   │  [Urgent Zone]                   │
│ 📅 周报   │  ┌──────────────────────────┐   │
│ 📊 月报   │  │ Task cards...             │   │
│ 📈 年报   │  └──────────────────────────┘   │
│ 📁 项目   │                                  │
│ ──────── │  [Important tasks]               │
│ ⚙️ 设置   │  ...                             │
│          │                                  │
└──────────┴──────────────────────────────────┘
```

**Breakpoints:**
- `< 768px`: Bottom tab bar (current), single column
- `768px – 1024px`: Narrow sidebar (icons only, 56px)
- `≥ 1024px`: Full sidebar (icons + labels, 200-260px, resizable)

**Implementation:**
- Create `src/Sidebar.tsx` + `src/Sidebar.module.css`
- Use CSS media queries + a React context for sidebar collapse state
- Sidebar width stored in `localStorage`, draggable resize handle on right edge
- `App.tsx` renders either `<Sidebar>` or `<BottomNav>` based on viewport

**Acceptance:** On a 1080p monitor, the app shows a sidebar with full navigation labels. Resize handle works. On mobile (< 768px), the bottom nav still works as before.

---

### P3-2: Inline Quick-Add Enhancement

**What:** Make the AddTaskForm's collapsed state smarter — allow quick actions without expanding the full form.

**Design (collapsed state, focused):**
```
┌──────────────────────────────────────────────┐
│ +  ________________________  [📅] [⏰] [→]   │
└──────────────────────────────────────────────┘
```
- Type title → press Enter → task created with defaults
- Click 📅 → dropdown: 今天 / 明天 / 下周一 / 选择日期
- Click ⏰ → dropdown: 今天 16:00 / 明天 9:00 / 选择时间
- Click → → expands full form with all fields

**Implementation:** Enhance `src/AddTaskForm.tsx`:
- When input is focused, show suffix action buttons
- Enter key submits with current defaults
- Date/time pickers use `<input type="date">` or custom lightweight picker

**Acceptance:** User can create a task with title + date in 2 clicks without seeing the full form.

---

## 7. Phase 4 — Polish (Ongoing)

### P4-1: Deduplicate CSS Across Summary Pages

Extract shared styles from `WeeklySummary.module.css`, `MonthlySummary.module.css`, `YearlyReport.module.css` into a shared `src/SummaryCommon.module.css`. Import in all three.

### P4-2: Focus-Visible Styles

Add `:focus-visible` outlines to all interactive elements. Replace `:focus` with `:focus-visible` throughout.

### P4-3: Inline Style Cleanup

Move all inline `style={{}}` objects into CSS module classes. Affected files: `App.tsx` (FAB), `YearlyReport.tsx`.

### P4-4: FAB Component Consolidation

Delete dead code `src/Fab.tsx`. Use a single FAB implementation across the app (the one currently inline in App.tsx, extracted to its own component).

### P4-5: Cancel Button Consistency

Standardize cancel button styles across `AddTaskForm`, `ProjectsPage`, `TaskEditPanel`. Pick one pattern and reuse.

---

## 8. Acceptance Criteria Summary

- [ ] Zero emoji characters in rendered output
- [ ] All delete actions show confirmation dialog
- [ ] Dark mode functional with readable text on any wallpaper
- [ ] Zero hardcoded hex colors outside `index.css`
- [ ] Task tags render as styled chips
- [ ] Completed section has smooth collapse animation
- [ ] Right-click shows context menu on task/project cards
- [ ] Theme color changeable in settings, applies instantly
- [ ] Desktop view shows sidebar layout
- [ ] Quick-add allows date/reminder without full form
- [ ] No duplicate CSS across summary pages
- [ ] `:focus-visible` used throughout
- [ ] Zero inline `style={{}}` objects

---

## 9. Non-Goals (for this spec)

- Switching frameworks (React → Vue)
- Adding a component library (NaiveUI for React doesn't exist; evaluating shadcn/ui is separate work)
- Server-side features (the app remains local-first PWA)
- User accounts or login system
