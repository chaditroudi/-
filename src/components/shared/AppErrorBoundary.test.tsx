import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary';

let shouldThrow = true;
const Screen = () => {
  if (shouldThrow) throw new Error('crash');
  return <p>Écran normal</p>;
};

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('replaces a crash with a way forward, not a white page', () => {
    render(<AppErrorBoundary><Screen /></AppErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Cet écran a rencontré un problème');
    expect(screen.getByRole('button', { name: 'Recharger' })).toBeInTheDocument();
  });

  it('lets a scoped screen retry without reloading', () => {
    render(<AppErrorBoundary scoped><Screen /></AppErrorBoundary>);
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(screen.getByText('Écran normal')).toBeInTheDocument();
  });

  it('clears when the employee moves to another screen', () => {
    const { rerender } = render(<AppErrorBoundary scoped resetKey="stock"><Screen /></AppErrorBoundary>);
    shouldThrow = false;
    rerender(<AppErrorBoundary scoped resetKey="production"><Screen /></AppErrorBoundary>);
    expect(screen.getByText('Écran normal')).toBeInTheDocument();
  });
});
