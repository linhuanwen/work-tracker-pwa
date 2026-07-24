import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Task } from '../types';
import { TaskList } from '../TaskList';

/**
 * Seam: TaskList archive collapsible
 *
 * The archive section shows cancelled tasks behind a toggle button.
 * Button label: "已完成 N" (N = count of cancelled tasks).
 * Expand/collapse uses grid-template-rows transition (200ms).
 */

// ================================================================
// Mock CSS modules (required by transitive imports from TaskList)
// ================================================================

vi.mock('../TaskList.module.css', () => ({
  default: {
    container: 'container',
    group: 'group',
    groupHeader: 'groupHeader',
    groupDot: 'groupDot',
    groupDotUrgent: 'groupDotUrgent',
    groupDotImportant: 'groupDotImportant',
    groupDotNormal: 'groupDotNormal',
    groupTitle: 'groupTitle',
    groupCount: 'groupCount',
    empty: 'empty',
    cards: 'cards',
    archiveSection: 'archiveSection',
    archiveToggle: 'archiveToggle',
    archiveArrow: 'archiveArrow',
    archiveArrowOpen: 'archiveArrowOpen',
    archiveCount: 'archiveCount',
    archiveCards: 'archiveCards',
    archiveCardsInner: 'archiveCardsInner',
  },
}));

vi.mock('../UrgentZone.module.css', () => ({
  default: {
    zone: 'zone', header: 'header', headerIcon: 'headerIcon',
    headerTitle: 'headerTitle', headerCount: 'headerCount', cards: 'cards',
    urgentCard: 'urgentCard', cardBody: 'cardBody', cardTitle: 'cardTitle',
    cardTitleDone: 'cardTitleDone', cardMeta: 'cardMeta', categoryTag: 'categoryTag',
    leaderBadge: 'leaderBadge', quantityTag: 'quantityTag', arrows: 'arrows',
    arrowBtn: 'arrowBtn',
  },
}));

vi.mock('../TaskCard.module.css', () => ({
  default: {
    card: 'card', cardHeader: 'cardHeader', cardHeaderExpanded: 'cardHeaderExpanded',
    statusDot: 'statusDot', statusTodo: 'statusTodo',
    statusInProgress: 'statusInProgress', statusDone: 'statusDone',
    statusCancelled: 'statusCancelled', body: 'body', title: 'title',
    titleDone: 'titleDone', titleCancelled: 'titleCancelled', meta: 'meta',
    categoryTag: 'categoryTag', priorityTag: 'priorityTag',
    priorityUrgent: 'priorityUrgent', priorityImportant: 'priorityImportant',
    priorityNormal: 'priorityNormal', deadlineTag: 'deadlineTag',
    dateFooter: 'dateFooter', dateText: 'dateText', statusSelect: 'statusSelect',
    expandArrow: 'expandArrow', expandArrowOpen: 'expandArrowOpen',
    editPanel: 'editPanel', editLabel: 'editLabel', editRow: 'editRow',
    editInput: 'editInput', editSelect: 'editSelect', editTextarea: 'editTextarea',
    editHint: 'editHint', priorityBtnGroup: 'priorityBtnGroup',
    priorityBtnActive: 'priorityBtnActive', toggleRow: 'toggleRow',
    toggleLabel: 'toggleLabel', toggle: 'toggle', toggleSlider: 'toggleSlider',
    leaderFields: 'leaderFields', leaderBadge: 'leaderBadge',
    quantityEditList: 'quantityEditList', quantityEditRow: 'quantityEditRow',
    quantityNumberInput: 'quantityNumberInput', quantityUnitInput: 'quantityUnitInput',
    removeBtn: 'removeBtn', addQuantityBtn: 'addQuantityBtn', quantityTag: 'quantityTag',
    priorityBtn: 'priorityBtn', deleteBtn: 'deleteBtn',
  },
}));

vi.mock('../Tag.module.css', () => ({
  default: {
    tag: 'tag',
    priority: 'priority',
    priorityUrgent: 'priorityUrgent',
    priorityImportant: 'priorityImportant',
    priorityNormal: 'priorityNormal',
    category: 'category',
    date: 'date',
  },
}));

// ================================================================
// Helpers
// ================================================================

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

const noop = () => {};

// ================================================================
// Tests
// ================================================================

describe('TaskList archive collapsible', () => {
  it('shows "已完成 N" label with cancelled task count', () => {
    const tasks: Task[] = [
      makeTask({ id: 'c1', title: '已取消任务1', status: 'cancelled' }),
      makeTask({ id: 'c2', title: '已取消任务2', status: 'cancelled' }),
    ];

    render(
      <TaskList
        tasks={tasks}
        categories={['其他']}
        onTransitionStatus={noop}
        onUpdateTask={noop}
        onEditTask={noop}
        onMoveUrgentUp={noop}
        onMoveUrgentDown={noop}
        toast={noop}
      />,
    );

    // Button should contain "已完成" and count "2"
    const toggle = screen.getByRole('button', { name: /已完成/ });
    expect(toggle).toBeDefined();
    expect(toggle.textContent).toContain('已完成');
    expect(toggle.textContent).toContain('2');
  });

  it('hides archive cards when collapsed by default', () => {
    const tasks: Task[] = [
      makeTask({ id: 'c1', title: '归档任务', status: 'cancelled' }),
    ];

    const { container } = render(
      <TaskList
        tasks={tasks}
        categories={['其他']}
        onTransitionStatus={noop}
        onUpdateTask={noop}
        onEditTask={noop}
        onMoveUrgentUp={noop}
        onMoveUrgentDown={noop}
        toast={noop}
      />,
    );

    // The inner wrapper should have grid-template-rows: 0fr (collapsed)
    const inner = container.querySelector('[data-archive-inner]');
    expect(inner).toBeDefined();
    expect(inner!.getAttribute('style')).toContain('grid-template-rows');
  });

  it('expands archive cards on toggle click', () => {
    const tasks: Task[] = [
      makeTask({ id: 'c1', title: '归档任务', status: 'cancelled' }),
    ];

    const { container } = render(
      <TaskList
        tasks={tasks}
        categories={['其他']}
        onTransitionStatus={noop}
        onUpdateTask={noop}
        onEditTask={noop}
        onMoveUrgentUp={noop}
        onMoveUrgentDown={noop}
        toast={noop}
      />,
    );

    const toggle = screen.getByRole('button', { name: /已完成/ });

    // Click to expand
    fireEvent.click(toggle);

    // The inner wrapper should now be expanded
    const inner = container.querySelector('[data-archive-inner]');
    expect(inner).toBeDefined();
    expect(inner!.getAttribute('style')).toContain('grid-template-rows');
  });

  it('does not render archive section when there are no cancelled tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', title: '活跃任务', status: 'todo' }),
    ];

    render(
      <TaskList
        tasks={tasks}
        categories={['其他']}
        onTransitionStatus={noop}
        onUpdateTask={noop}
        onEditTask={noop}
        onMoveUrgentUp={noop}
        onMoveUrgentDown={noop}
        toast={noop}
      />,
    );

    // No "已完成" button should exist
    expect(screen.queryByRole('button', { name: /已完成/ })).toBeNull();
  });

  it('uses 200ms transition for the grid-template-rows animation', () => {
    const tasks: Task[] = [
      makeTask({ id: 'c1', title: '归档任务', status: 'cancelled' }),
    ];

    const { container } = render(
      <TaskList
        tasks={tasks}
        categories={['其他']}
        onTransitionStatus={noop}
        onUpdateTask={noop}
        onEditTask={noop}
        onMoveUrgentUp={noop}
        onMoveUrgentDown={noop}
        toast={noop}
      />,
    );

    const inner = container.querySelector('[data-archive-inner]');
    expect(inner!.getAttribute('style')).toContain('200ms');
  });
});
