import { createElement } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmployees } from './useEmployees';
import { useTasks } from './useTasks';
import { useTimesheets } from './useTimesheets';
import { resolveDataCondition } from '@/lib/dataCondition';

const state = vi.hoisted(() => ({ actorId: 'actor-a', roles: ['administrateur_systeme'], toast: vi.fn(), employees: vi.fn(), tasks: vi.fn(), timesheets: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { id: state.actorId }, roles: state.roles }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/lib/api/hr', () => ({ hrApi: { listEmployees: state.employees, listTasks: state.tasks, listTimesheets: state.timesheets } }));
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
beforeEach(() => {
  state.actorId = 'actor-a';
  state.roles = ['administrateur_systeme'];
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(() => { cleanup(); client.clear(); });
const cases = [
  { name: 'employees', read: state.employees, hook: useEmployees },
  { name: 'tasks', read: state.tasks, hook: useTasks },
  { name: 'timesheets', read: state.timesheets, hook: useTimesheets },
];

describe('HR read truthfulness and session ownership', () => {
  for (const entry of cases) {
    it(entry.name + ': unresolved role policy starts no read and exposes no old data', () => {
      state.roles = [];
      const { result } = renderHook(() => entry.hook(), { wrapper });
      expect(entry.read).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
      expect(resolveDataCondition({ ...result.current, data: result.current.data, online: true })).toBe('restricted');
    });
    it(entry.name + ': denied reads remain restricted, never an empty register', async () => {
      entry.read.mockRejectedValue(Object.assign(new Error('Denied'), { status: 403 }));
      const { result } = renderHook(() => entry.hook(), { wrapper });
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.data).toBeUndefined();
      expect(resolveDataCondition({ ...result.current, data: result.current.data, online: true })).toBe('restricted');
    });
    it(entry.name + ': a late prior-account response cannot become the next account data', async () => {
      let finishOld!: (rows: unknown[]) => void;
      entry.read.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockRejectedValueOnce(Object.assign(new Error('Denied for B'), { status: 403 }));
      const { result, rerender } = renderHook(() => entry.hook(), { wrapper });
      await waitFor(() => expect(entry.read).toHaveBeenCalledTimes(1));
      state.actorId = 'actor-b'; rerender();
      expect(result.current.data).toBeUndefined();
      await waitFor(() => expect(result.current.error).toBeTruthy());
      await act(async () => { finishOld([{ id: 'private-to-a', title: 'Prior account' }]); });
      expect(result.current.data).toBeUndefined();
      expect(resolveDataCondition({ ...result.current, data: result.current.data, online: true })).toBe('restricted');
    });
  }
  it('keeps a successfully loaded snapshot explicitly stale when refresh fails', async () => {
    state.tasks.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Unavailable'));
    const { result } = renderHook(() => useTasks(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    const loadedAt = result.current.updatedAt;
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toEqual([]);
    expect(result.current.updatedAt).toBe(loadedAt);
    expect(resolveDataCondition({ ...result.current, data: result.current.data, online: true })).toBe('stale');
  });
  it('does not display a previous employee filter while the new filter is denied', async () => {
    state.timesheets.mockResolvedValueOnce([{ id: 'employee-a-only' }]).mockRejectedValueOnce(Object.assign(new Error('Denied'), { status: 403 }));
    const { result, rerender } = renderHook(({ id }) => useTimesheets(id), { initialProps: { id: 'employee-a' }, wrapper });
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('employee-a-only'));
    rerender({ id: 'employee-b' });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(state.timesheets).toHaveBeenLastCalledWith({ employee_id: 'employee-b' });
    expect(result.current.data).toBeUndefined();
  });
});
