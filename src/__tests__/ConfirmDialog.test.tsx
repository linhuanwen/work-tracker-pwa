import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Seam: ConfirmDialog component
 *
 * Uses native <dialog> with showModal()/close().
 * Tests cover open/close/confirm/cancel behaviors through the public API.
 */

// Polyfill dialog.showModal() / dialog.close() for jsdom
// jsdom doesn't implement these methods yet.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
});

// Mock CSS module
vi.mock('../ConfirmDialog.module.css', () => ({
  default: {
    dialog: 'dialog',
    content: 'content',
    header: 'header',
    title: 'title',
    message: 'message',
    footer: 'footer',
    cancelBtn: 'cancelBtn',
    confirmBtn: 'confirmBtn',
  },
}));

import { ConfirmDialog } from '../ConfirmDialog';

// ----------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------

/**
 * jsdom's HTMLDialogElement is limited — showModal() doesn't fully
 * work. We test behavior through click events on rendered buttons
 * and verifying callback invocations.
 */

// ----------------------------------------------------------------
// Seam: ConfirmDialog open/close/confirm/cancel
// ----------------------------------------------------------------

describe('ConfirmDialog — open', () => {
  it('renders title and message in the DOM when open=true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="确认删除"
        message="此操作不可撤销，确定删除吗？"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    // Title (heading) and message should be visible
    expect(screen.getByRole('heading', { name: '确认删除' })).toBeDefined();
    expect(screen.getByText('此操作不可撤销，确定删除吗？')).toBeDefined();
  });

  it('renders custom confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        open={true}
        title="删除"
        message="确定？"
        confirmLabel="是的"
        cancelLabel="不了"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('是的')).toBeDefined();
    expect(screen.getByText('不了')).toBeDefined();
  });

  it('renders default button labels when not provided', () => {
    render(
      <ConfirmDialog
        open={true}
        title="确认"
        message="继续？"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '确认删除' })).toBeDefined();
    expect(screen.getByRole('button', { name: '取消' })).toBeDefined();
  });
});

describe('ConfirmDialog — confirm', () => {
  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="确认删除"
        message="确定？"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: '确认删除' });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog — cancel', () => {
  it('calls onCancel when cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="确认删除"
        message="确定？"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when clicking the dialog backdrop (dialog element itself)', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="确认删除"
        message="确定？"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    // The <dialog> element is the backdrop; clicking it (not inner content)
    // should trigger onCancel
    const dialog = document.querySelector('dialog');
    expect(dialog).not.toBeNull();

    // Simulate click directly on the dialog element (backdrop)
    fireEvent.click(dialog!);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
