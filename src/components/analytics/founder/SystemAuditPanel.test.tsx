import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemAuditPanel } from './SystemAuditPanel';
const calls = vi.hoisted(() => ({ stats: vi.fn(), logs: vi.fn() }));
vi.mock('@/hooks/useSystemAudit', () => ({ useAuditStats: calls.stats, useAuditLogs: calls.logs }));
vi.mock('recharts', () => ({ BarChart: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, ResponsiveContainer: () => null, CartesianGrid: () => null, AreaChart: () => null, Area: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });
const loading = () => ({ data: undefined, isLoading: true, isError: false, error: null, dataUpdatedAt: 0, refetch: vi.fn() });
describe('system audit rolling read window', () => {
  it('does not restart both queries just because the component renders again', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000_000);
    calls.stats.mockImplementation(loading); calls.logs.mockImplementation(loading);
    const screen = render(<SystemAuditPanel />);
    const original = calls.stats.mock.calls.at(-1)?.[0];
    clock.mockReturnValue(2_000_000_000_025); screen.rerender(<SystemAuditPanel />);
    expect(calls.stats.mock.calls.at(-1)?.[0]).toBe(original);
    expect(calls.logs.mock.calls.at(-1)?.[0].from).toBe(original);
  });
  it('advances the shared window at minute precision, not on each query update', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000_000);
    calls.stats.mockImplementation(loading); calls.logs.mockImplementation(loading);
    const screen = render(<SystemAuditPanel />);
    const original = calls.stats.mock.calls.at(-1)?.[0];
    clock.mockReturnValue(2_000_000_060_000); screen.rerender(<SystemAuditPanel />);
    const advanced = calls.stats.mock.calls.at(-1)?.[0];
    expect(advanced).not.toBe(original);
    expect(calls.logs.mock.calls.at(-1)?.[0].from).toBe(advanced);
    clock.mockReturnValue(2_000_000_060_025); screen.rerender(<SystemAuditPanel />);
    expect(calls.stats.mock.calls.at(-1)?.[0]).toBe(advanced);
  });
});
