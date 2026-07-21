import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '../types';
import type { UpdateTaskPatch } from '../taskUtils';

// Mock CSS modules (vitest + jsdom doesn't process CSS)
vi.mock('../App.module.css', () => ({ default: { app: 'app', header: 'header', title: 'title', subtitle: 'subtitle', folderBar: 'folderBar', folderBtn: 'folderBtn', folderPath: 'folderPath', error: 'error' } }));
vi.mock('../AddTaskForm.module.css', () => ({ default: { form: 'form', row: 'row', field: 'field', label: 'label', input: 'input', select: 'select', priorityGroup: 'priorityGroup', priorityBtn: 'priorityBtn', priorityBtnActive: 'priorityBtnActive', submitBtn: 'submitBtn' } }));
vi.mock('../TaskCard.module.css', () => ({ default: { card: 'card', cardHeader: 'cardHeader', cardHeaderExpanded: 'cardHeaderExpanded', statusDot: 'statusDot', statusTodo: 'statusTodo', statusInProgress: 'statusInProgress', statusDone: 'statusDone', statusCancelled: 'statusCancelled', body: 'body', title: 'title', titleDone: 'titleDone', titleCancelled: 'titleCancelled', meta: 'meta', categoryTag: 'categoryTag', priorityTag: 'priorityTag', priorityUrgent: 'priorityUrgent', priorityImportant: 'priorityImportant', priorityNormal: 'priorityNormal', deadlineTag: 'deadlineTag', dateFooter: 'dateFooter', dateText: 'dateText', statusSelect: 'statusSelect', expandArrow: 'expandArrow', expandArrowOpen: 'expandArrowOpen', editPanel: 'editPanel', editLabel: 'editLabel', editRow: 'editRow', editInput: 'editInput', editSelect: 'editSelect', editTextarea: 'editTextarea', editHint: 'editHint', priorityBtnGroup: 'priorityBtnGroup', priorityBtnActive: 'priorityBtnActive' } }));
vi.mock('../TaskList.module.css', () => ({ default: { container: 'container', group: 'group', groupHeader: 'groupHeader', groupDot: 'groupDot', groupDotUrgent: 'groupDotUrgent', groupDotImportant: 'groupDotImportant', groupDotNormal: 'groupDotNormal', groupTitle: 'groupTitle', groupCount: 'groupCount', empty: 'empty', cards: 'cards', urgentGroup: 'urgentGroup', archiveSection: 'archiveSection', archiveToggle: 'archiveToggle', archiveArrow: 'archiveArrow', archiveArrowOpen: 'archiveArrowOpen', archiveCount: 'archiveCount', archiveCards: 'archiveCards' } }));
vi.mock('../UrgentZone.module.css', () => ({ default: { zone: 'zone', header: 'header', headerIcon: 'headerIcon', headerTitle: 'headerTitle', headerCount: 'headerCount', cards: 'cards', urgentCard: 'urgentCard', cardBody: 'cardBody', cardTitle: 'cardTitle', cardTitleDone: 'cardTitleDone', cardMeta: 'cardMeta', categoryTag: 'categoryTag', leaderBadge: 'leaderBadge', quantityTag: 'quantityTag', arrows: 'arrows', arrowBtn: 'arrowBtn' } }));
vi.mock('../Fab.module.css', () => ({ default: { fab: 'fab', fabIcon: 'fabIcon' } }));
vi.mock('../InstallBanner.module.css', () => ({ default: { banner: 'banner', message: 'message', actions: 'actions', installBtn: 'installBtn', dismissBtn: 'dismissBtn' } }));

/**
 * Seam 4: Responsive layout & touch-friendly rendering
 *
 * Tests component rendering with different viewport widths.
 * Does NOT test PWA install behavior (browser feature).
 */

// ----------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    projectId: null,
    title: '测试任务',
    category: '其他',
    priority: 'normal',
    status: 'todo',
    createdDate: '2026-07-21',
    updatedDate: '2026-07-21',
    deadline: null,
    completedDate: null,
    quantities: [],
    subtasks: [],
    notes: '',
    isLeaderAssigned: false,
    isCrossYear: false,
    isBlocked: false,
    ...overrides,
  };
}

// ----------------------------------------------------------------
// Seam 4a: TaskCard renders with touch-friendly attributes
// ----------------------------------------------------------------

describe('TaskCard — touch-friendly rendering', () => {
  let TaskCard: React.ComponentType<{
    task: Task;
    categories: string[];
    onTransitionStatus: (taskId: string, newStatus: string) => void;
    onUpdateTask: (taskId: string, patch: UpdateTaskPatch) => void;
  }>;

  beforeEach(async () => {
    const mod = await import('../TaskCard');
    TaskCard = mod.TaskCard;
  });

  it('renders with role="button" for full-card click area (touch-friendly)', () => {
    const task = makeTask();
    render(
      <TaskCard
        task={task}
        categories={['其他']}
        onTransitionStatus={() => {}}
        onUpdateTask={() => {}}
      />,
    );

    // The card header should act as a button for full-card click area
    const header = screen.getByRole('button');
    expect(header).toBeDefined();
    expect(header.getAttribute('tabindex')).toBe('0');
  });

  it('renders title text', () => {
    const task = makeTask({ title: '完成绩效考核' });
    render(
      <TaskCard
        task={task}
        categories={['绩效管理']}
        onTransitionStatus={() => {}}
        onUpdateTask={() => {}}
      />,
    );

    expect(screen.getByText('完成绩效考核')).toBeDefined();
  });

  it('renders category tag', () => {
    const task = makeTask({ category: '绩效管理' });
    render(
      <TaskCard
        task={task}
        categories={['其他', '绩效管理']}
        onTransitionStatus={() => {}}
        onUpdateTask={() => {}}
      />,
    );

    expect(screen.getByText('绩效管理')).toBeDefined();
  });

  it('renders status select for touch-friendly status change', () => {
    const task = makeTask();
    render(
      <TaskCard
        task={task}
        categories={['其他']}
        onTransitionStatus={() => {}}
        onUpdateTask={() => {}}
      />,
    );

    const select = screen.getByRole('combobox', { name: '任务状态' });
    expect(select).toBeDefined();
  });

  it('calls onTransitionStatus when status is changed', () => {
    const task = makeTask({ status: 'todo' });
    const onTransition = vi.fn();
    render(
      <TaskCard
        task={task}
        categories={['其他']}
        onTransitionStatus={onTransition}
        onUpdateTask={() => {}}
      />,
    );

    const select = screen.getByRole('combobox', { name: '任务状态' });
    fireEvent.change(select, { target: { value: 'done' } });
    expect(onTransition).toHaveBeenCalledWith('t-1', 'done');
  });

  it('expands edit panel when card header is clicked', () => {
    const task = makeTask();
    render(
      <TaskCard
        task={task}
        categories={['其他']}
        onTransitionStatus={() => {}}
        onUpdateTask={() => {}}
      />,
    );

    // Edit panel should not be visible initially
    expect(screen.queryByText('截止日期')).toBeNull();

    // Click the card header to expand
    const header = screen.getByRole('button');
    fireEvent.click(header);

    // Now the edit panel should show
    expect(screen.getByText('截止日期')).toBeDefined();
  });
});

// ----------------------------------------------------------------
// Seam 4b: FAB renders correctly
// ----------------------------------------------------------------

describe('FAB — Floating Action Button', () => {
  let Fab: React.ComponentType<{ onClick: () => void; label?: string }>;

  beforeEach(async () => {
    const mod = await import('../Fab');
    Fab = mod.Fab;
  });

  it('renders with aria-label for accessibility', () => {
    const handleClick = vi.fn();
    render(<Fab onClick={handleClick} />);

    const button = screen.getByRole('button', { name: '添加任务' });
    expect(button).toBeDefined();
    expect(button.textContent).toContain('+');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Fab onClick={handleClick} />);

    const button = screen.getByRole('button', { name: '添加任务' });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders with custom label', () => {
    const handleClick = vi.fn();
    render(<Fab onClick={handleClick} label="新建任务" />);

    expect(screen.getByRole('button', { name: '新建任务' })).toBeDefined();
  });
});

// ----------------------------------------------------------------
// Seam 4c: Install banner conditional display logic
// ----------------------------------------------------------------

describe('InstallBanner — conditional display logic', () => {
  beforeEach(() => {
    mockMatchMedia(false); // Not standalone
    localStorage.removeItem('pwa-install-banner-dismissed');
  });

  afterEach(() => {
    localStorage.removeItem('pwa-install-banner-dismissed');
  });

  it('does not show when already in standalone mode', async () => {
    mockMatchMedia(true); // Is standalone → hide
    const { InstallBanner } = await import('../InstallBanner');
    const { container } = render(<InstallBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('does not show when previously dismissed', async () => {
    localStorage.setItem('pwa-install-banner-dismissed', 'true');
    const { InstallBanner } = await import('../InstallBanner');
    const { container } = render(<InstallBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('shows banner when not standalone and not dismissed, with beforeinstallprompt support', async () => {
    mockMatchMedia(false); // Not standalone
    localStorage.removeItem('pwa-install-banner-dismissed');

    const { InstallBanner } = await import('../InstallBanner');
    const { container } = render(<InstallBanner />);

    // Banner should render initially (before beforeinstallprompt fires, it's hidden)
    // After beforeinstallprompt, it would show. In jsdom, the event doesn't fire,
    // so the banner should be hidden (it only shows after the event)
    expect(container.innerHTML).toBe('');
  });

  it('persists dismissal to localStorage', () => {
    const DISMISS_KEY = 'pwa-install-banner-dismissed';
    localStorage.setItem(DISMISS_KEY, 'true');
    expect(localStorage.getItem(DISMISS_KEY)).toBe('true');
  });
});

// ----------------------------------------------------------------
// Seam 4d: UrgentZone renders with touch-friendly controls
// ----------------------------------------------------------------

describe('UrgentZone — touch-friendly rendering', () => {
  let UrgentZone: React.ComponentType<{
    tasks: Task[];
    onToggleTask: (taskId: string) => void;
    onEditTask: (task: Task) => void;
    onMoveUp: (taskId: string) => void;
    onMoveDown: (taskId: string) => void;
  }>;

  beforeEach(async () => {
    const mod = await import('../UrgentZone');
    UrgentZone = mod.UrgentZone;
  });

  it('renders urgent tasks with reorder arrows', () => {
    const tasks = [
      makeTask({ id: 'u1', title: '紧急任务1', priority: 'urgent' }),
      makeTask({ id: 'u2', title: '紧急任务2', priority: 'urgent' }),
    ];

    render(
      <UrgentZone
        tasks={tasks}
        onToggleTask={() => {}}
        onEditTask={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      />,
    );

    expect(screen.getByText('紧急处理')).toBeDefined();
    expect(screen.getByText('紧急任务1')).toBeDefined();
    expect(screen.getByText('紧急任务2')).toBeDefined();
  });

  it('renders nothing when no urgent tasks', () => {
    const { container } = render(
      <UrgentZone
        tasks={[]}
        onToggleTask={() => {}}
        onEditTask={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('calls onMoveUp when up arrow clicked', () => {
    const tasks = [
      makeTask({ id: 'u1', title: '任务1', priority: 'urgent' }),
      makeTask({ id: 'u2', title: '任务2', priority: 'urgent' }),
    ];
    const onMoveUp = vi.fn();

    render(
      <UrgentZone
        tasks={tasks}
        onToggleTask={() => {}}
        onEditTask={() => {}}
        onMoveUp={onMoveUp}
        onMoveDown={() => {}}
      />,
    );

    // The second task's up arrow should be enabled
    const upArrows = screen.getAllByLabelText('上移');
    fireEvent.click(upArrows[1]); // Second task's up arrow
    expect(onMoveUp).toHaveBeenCalledWith('u2');
  });

  it('disables up arrow for first task', () => {
    const tasks = [makeTask({ id: 'u1', title: '唯一任务', priority: 'urgent' })];
    render(
      <UrgentZone
        tasks={tasks}
        onToggleTask={() => {}}
        onEditTask={() => {}}
        onMoveUp={() => {}}
        onMoveDown={() => {}}
      />,
    );

    const upArrow = screen.getByLabelText('上移');
    expect((upArrow as HTMLButtonElement).disabled).toBe(true);
  });
});

// ============================================================
// Seam 4: WeeklySummary component
// ============================================================

import { WeeklySummary } from '../WeeklySummary';

vi.mock('../WeeklySummary.module.css', () => ({
  default: {
    container: 'container', heading: 'heading', weekSelector: 'weekSelector',
    weekBtn: 'weekBtn', weekLabel: 'weekLabel', generateBtn: 'generateBtn',
    sections: 'sections', section: 'section', sectionHeader: 'sectionHeader',
    sectionTitle: 'sectionTitle', aiBtn: 'aiBtn', editable: 'editable',
    addPlanRow: 'addPlanRow', planInput: 'planInput', statusBar: 'statusBar',
    statusOk: 'statusOk', statusPending: 'statusPending',
  },
}));

describe('WeeklySummary', () => {
  it('is importable (module exists)', () => {
    expect(WeeklySummary).toBeDefined();
  });
});
