import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyUpdateWhenSafe, canReloadNow } from './appUpdate';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('canReloadNow', () => {
  it('allows a reload on a resting screen', () => {
    document.body.innerHTML = '<main><button>Ouvrir</button></main>';
    expect(canReloadNow()).toBe(true);
  });

  it('waits while a dialog is open', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    expect(canReloadNow()).toBe(false);
  });

  it('waits while a reception is being entered', () => {
    document.body.innerHTML = '<section data-work-in-progress></section>';
    expect(canReloadNow()).toBe(false);
  });

  it('waits while someone is typing in a field', () => {
    document.body.innerHTML = '<input id="weight" />';
    document.getElementById('weight')?.focus();
    expect(canReloadNow()).toBe(false);
  });
});

describe('applyUpdateWhenSafe', () => {
  it('reloads at once when nothing is open', () => {
    const reload = vi.fn();
    const onWaiting = vi.fn();
    applyUpdateWhenSafe({ reload, onWaiting });
    expect(reload).toHaveBeenCalledOnce();
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it('never reloads over work, and offers the reload instead', () => {
    document.body.innerHTML = '<section data-work-in-progress></section>';
    const reload = vi.fn();
    const onWaiting = vi.fn();
    applyUpdateWhenSafe({ reload, onWaiting });
    expect(reload).not.toHaveBeenCalled();
    expect(onWaiting).toHaveBeenCalledWith(reload);
  });

  it('applies it later, once the work is done and the screen is hidden', () => {
    document.body.innerHTML = '<section data-work-in-progress></section>';
    const reload = vi.fn();
    applyUpdateWhenSafe({ reload, onWaiting: vi.fn() });

    document.body.innerHTML = '';
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(reload).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
