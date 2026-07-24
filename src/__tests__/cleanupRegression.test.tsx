/**
 * Cleanup Regression Tests
 *
 * Covers:
 *   Seam 1 — SummaryCommon.module.css style extraction
 *   Seam 2 — :focus vs :focus-visible correctness
 *   Seam 3 — Inline style migration to CSS Module classes
 *   Seam 4 — Dead code removal (Fab.tsx) & FAB consolidation
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC_DIR = resolve(process.cwd(), 'src');

// ============================================================
// Helpers
// ============================================================

function readCssModule(name: string): string {
  return readFileSync(resolve(SRC_DIR, `${name}.module.css`), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  try {
    readFileSync(resolve(SRC_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Seam 1: SummaryCommon.module.css style extraction
// ============================================================

describe('SummaryCommon — shared style extraction', () => {
  const SHARED_CLASSES = [
    'container',
    'backBtn',
    'heading',
    'generateBtn',
    'regenerateBtn',
    'sections',
    'section',
    'sectionHeader',
    'sectionTitle',
    'aiBtn',
    'editable',
    'addPlanRow',
    'planInput',
    'statusBar',
    'statusOk',
    'statusPending',
  ];

  it('SummaryCommon.module.css exists', () => {
    expect(fileExists('SummaryCommon.module.css')).toBe(true);
  });

  it('defines all shared classes', () => {
    const content = readCssModule('SummaryCommon');
    for (const cls of SHARED_CLASSES) {
      const regex = new RegExp(`\\.${cls}\\s*\\{`);
      expect(content).toMatch(regex);
    }
  });

  it('WeeklySummary.module.css composes from SummaryCommon', () => {
    const content = readCssModule('WeeklySummary');
    const composeCount = (content.match(/composes:.*from '\.\/SummaryCommon\.module\.css'/g) || []).length;
    expect(composeCount).toBeGreaterThanOrEqual(SHARED_CLASSES.length);
  });

  it('MonthlySummary.module.css composes from SummaryCommon', () => {
    const content = readCssModule('MonthlySummary');
    const composeCount = (content.match(/composes:.*from '\.\/SummaryCommon\.module\.css'/g) || []).length;
    expect(composeCount).toBeGreaterThanOrEqual(SHARED_CLASSES.length);
  });

  it('YearlyReport.module.css composes from SummaryCommon', () => {
    const content = readCssModule('YearlyReport');
    const composeCount = (content.match(/composes:.*from '\.\/SummaryCommon\.module\.css'/g) || []).length;
    // YearlyReport doesn't use addPlanRow/planInput, so fewer composes
    expect(composeCount).toBeGreaterThanOrEqual(SHARED_CLASSES.length - 2);
  });

  it('YearlyReport overrides container max-width to 760px', () => {
    const content = readCssModule('YearlyReport');
    expect(content).toMatch(/composes:\s*container\b/);
    expect(content).toMatch(/max-width:\s*760px/);
  });

  it('MonthlySummary overrides statusBar font-size to var(--fs-tag)', () => {
    const content = readCssModule('MonthlySummary');
    expect(content).toMatch(/composes:\s*statusBar\b/);
    expect(content).toMatch(/font-size:\s*var\(--fs-tag\)/);
  });

  it('original duplicate blocks are removed from WeeklySummary', () => {
    const content = readCssModule('WeeklySummary');
    // Should NOT contain standalone rule blocks — only composes blocks
    // Each class should appear at most once (the composes declaration)
    const containerMatches = content.match(/\.container\s*\{/g) || [];
    expect(containerMatches.length).toBe(1); // only the composes block
    // The old duplicate content should not exist
    expect(content).not.toMatch(/\.backBtn:hover\s*\{/);
  });

  it('duplicate sections class is now available in YearlyReport (was missing)', () => {
    const content = readCssModule('YearlyReport');
    expect(content).toMatch(/\.sections\s*\{/);
    expect(content).toMatch(/composes:\s*sections\b/);
  });
});

// ============================================================
// Seam 2: :focus vs :focus-visible correctness
// ============================================================

describe('focus-visible — no :focus on non-form elements', () => {
  const CSS_MODULES = [
    'AddTaskForm',
    'App',
    'BottomNav',
    'ConfirmDialog',
    'ContextMenu',
    'HibernateDrawer',
    'InstallBanner',
    'MonthlySummary',
    'ProjectDetailPage',
    'ProjectsPage',
    'Reports',
    'Settings',
    'Sidebar',
    'SummaryCommon',
    'Tag',
    'TaskCard',
    'TaskEditPanel',
    'TaskList',
    'ThemePicker',
    'ThemeToggle',
    'Toast',
    'UrgentZone',
    'WeeklySummary',
    'YearlyReport',
  ];

  // Allowed :focus — form elements and contentEditable
  // oneLinerEditor, reflectionTextarea, keypointTextarea are textarea elements
  const FORM_CLASS_PATTERNS = [
    /input/i, /select/i, /textarea/i, /editable/i, /editor/i, /daySelect/i,
  ];

  it('no :focus pseudo-class on non-form element classes', () => {
    const violations: string[] = [];

    for (const modName of CSS_MODULES) {
      if (!fileExists(`${modName}.module.css`)) continue;
      const content = readCssModule(modName);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Match :focus but NOT :focus-visible or :focus-within
        if (!line.match(/:focus(?!-visible|-within)/)) continue;
        // Skip comments
        if (line.startsWith('/*')) continue;

        // Check if the selector matches a form element pattern
        const isFormElement = FORM_CLASS_PATTERNS.some((p) => p.test(line));
        if (!isFormElement) {
          violations.push(`  ${modName}.module.css:${i + 1}: "${line}"`);
        }
      }
    }

    expect(
      violations,
      `:focus found on non-form elements:\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });

  it('Sidebar nav items use :focus-visible (not :focus)', () => {
    const content = readCssModule('Sidebar');
    expect(content).toMatch(/\.navItem:focus-visible/);
  });
});

// ============================================================
// Seam 3: Inline style migration
// ============================================================

describe('Inline style → CSS Module migration', () => {
  it('TaskCard.module.css has subtask progress classes', () => {
    const content = readCssModule('TaskCard');
    expect(content).toMatch(/\.subtaskProgress\s*\{/);
    expect(content).toMatch(/\.subtaskProgressTrack\s*\{/);
    expect(content).toMatch(/\.subtaskProgressFill\s*\{/);
    expect(content).toMatch(/\.subtaskProgressCount\s*\{/);
    expect(content).toMatch(/\.subtaskDoneBtn\s*\{/);
  });

  it('TaskEditPanel.module.css has priority button classes', () => {
    const content = readCssModule('TaskEditPanel');
    expect(content).toMatch(/\.priorityGroup\s*\{/);
    expect(content).toMatch(/\.priorityBtn\s*\{/);
    expect(content).toMatch(/\.priorityBtnActiveUrgent\s*\{/);
    expect(content).toMatch(/\.priorityBtnActiveImportant\s*\{/);
    expect(content).toMatch(/\.priorityBtnActiveNormal\s*\{/);
  });

  it('TaskEditPanel.module.css has subtask and counter classes', () => {
    const content = readCssModule('TaskEditPanel');
    expect(content).toMatch(/\.sectionCounter\s*\{/);
    expect(content).toMatch(/\.subtaskCheckbox\s*\{/);
    expect(content).toMatch(/\.subtaskTitle\s*\{/);
    expect(content).toMatch(/\.subtaskTitleDone\s*\{/);
    expect(content).toMatch(/\.subtaskInputRow\s*\{/);
    expect(content).toMatch(/\.hintLabel\s*\{/);
  });

  it('YearlyReport.module.css has AI row and table classes', () => {
    const content = readCssModule('YearlyReport');
    expect(content).toMatch(/\.aiBtnRow\s*\{/);
    expect(content).toMatch(/\.tableWrapper\s*\{/);
    expect(content).toMatch(/\.boldCell\s*\{/);
    expect(content).toMatch(/\.emptyState\s*\{/);
  });

  it('YearlyReport TSX has no static inline style={{}} blocks', () => {
    const content = readFileSync(resolve(SRC_DIR, 'YearlyReport.tsx'), 'utf-8');
    // Only dynamic styles should remain (width %, background, position)
    const styleMatches = content.match(/style=\{\{/g) || [];
    // After migration: 0 static style blocks remain
    // (any remaining should be dynamic only)
    expect(styleMatches.length).toBe(0);
  });

  it('WeeklySummary TSX has no inline style={{}}', () => {
    const content = readFileSync(resolve(SRC_DIR, 'WeeklySummary.tsx'), 'utf-8');
    expect(content).not.toMatch(/style=\{\{/);
  });

  it('MonthlySummary TSX has no inline style={{}}', () => {
    const content = readFileSync(resolve(SRC_DIR, 'MonthlySummary.tsx'), 'utf-8');
    expect(content).not.toMatch(/style=\{\{/);
  });

  it('TaskCard TSX subtask progress uses CSS classes (only dynamic width/color remain inline)', () => {
    const content = readFileSync(resolve(SRC_DIR, 'TaskCard.tsx'), 'utf-8');
    // The progress fill has dynamic width + background → okay to have style
    // Everything else should use classes
    expect(content).toMatch(/subtaskProgress/);
    expect(content).toMatch(/subtaskProgressTrack/);
    expect(content).toMatch(/subtaskProgressFill/);
    expect(content).toMatch(/subtaskProgressCount/);
    expect(content).toMatch(/subtaskDoneBtn/);
  });

  it('TaskEditPanel TSX priority buttons use CSS classes', () => {
    const content = readFileSync(resolve(SRC_DIR, 'TaskEditPanel.tsx'), 'utf-8');
    expect(content).toMatch(/priorityGroup/);
    expect(content).toMatch(/priorityBtn\b/);
    expect(content).toMatch(/priorityBtnActiveUrgent/);
  });
});

// ============================================================
// Seam 4: Dead code removal & FAB consolidation
// ============================================================

describe('Dead code removal — Fab.tsx', () => {
  it('Fab.tsx no longer exists', () => {
    expect(fileExists('Fab.tsx')).toBe(false);
  });

  it('Fab.module.css no longer exists', () => {
    expect(fileExists('Fab.module.css')).toBe(false);
  });

  it('App.module.css no longer has .fab styles', () => {
    const content = readCssModule('App');
    expect(content).not.toMatch(/\.fab\s*\{/);
  });

  it('App.tsx no longer renders the FAB', () => {
    const content = readFileSync(resolve(SRC_DIR, 'App.tsx'), 'utf-8');
    expect(content).not.toMatch(/className=\{styles\.fab\}/);
    expect(content).not.toMatch(/aria-label="添加任务"/);
  });
});

// ============================================================
// Seam 5: Cancel button style unification
// ============================================================

describe('Cancel button style unification', () => {
  it('ConfirmDialog cancelBtn uses consistent glassy style', () => {
    const content = readCssModule('ConfirmDialog');
    expect(content).toMatch(/\.cancelBtn\s*\{/);
    expect(content).toMatch(/var\(--glass-bg-input\)/);
    expect(content).toMatch(/var\(--glass-border-subtle\)/);
  });

  it('TaskEditPanel cancelBtn uses consistent glassy style', () => {
    const content = readCssModule('TaskEditPanel');
    expect(content).toMatch(/\.cancelBtn\s*\{/);
    expect(content).toMatch(/var\(--glass-bg-input\)/);
  });

  it('no cancel button uses bare hex colors (uses design tokens)', () => {
    const modules = ['ConfirmDialog', 'TaskEditPanel', 'AddTaskForm', 'ProjectsPage'];
    for (const mod of modules) {
      if (!fileExists(`${mod}.module.css`)) continue;
      const content = readCssModule(mod);
      // All cancel-related buttons should use tokens, not raw hex
      const cancelSection = content.match(/\.cancelBtn[^{]*\{[^}]*\}/g);
      if (cancelSection) {
        for (const block of cancelSection) {
          // Should not contain raw #xxx colors for background
          expect(block).not.toMatch(/background:\s*#[0-9a-fA-F]{3,6}/);
        }
      }
    }
  });
});
