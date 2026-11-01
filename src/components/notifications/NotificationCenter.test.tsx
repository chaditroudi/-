import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/axiosClient';
import { NotificationCenter } from './NotificationCenter';

const state = vi.hoisted(() => ({ source: { data: undefined as unknown, error: null as unknown, isLoading: false, isFetching: false, refetch: vi.fn() }, summary: { data: { unread: 205, critical: 0, warning: 205, total: 205 }, error: null } }));
vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => state.source,
  useNotificationSummary: () => state.summary,
  useNotificationRealtimeState: () => ({ recentNotifications: [], lastRealtimeAt: null }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllRead: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/contexts/SettingsContext', () => ({ useSettingsContext: () => ({ settings: { notifications: { browser_notifications_enabled: false } } }) }));

const open = () => {
  render(<MemoryRouter><NotificationCenter /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
};

describe('notification centre truthfulness', () => {
  beforeEach(() => { state.source.data = undefined; state.source.error = null; });
  it.each([403, 500])('explains HTTP %s instead of showing a calm empty list', status => {
    state.source.error = new ApiRequestError({ status, message: 'Erreur' });
    open();
    expect(screen.getByText(status === 403 ? 'Accès réservé' : 'Données indisponibles')).toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });
  it('uses the full authorized unread count instead of the displayed list length', () => {
    state.source.data = [];
    open();
    expect(screen.getByRole('button', { name: 'Notifications (205 non lues)' })).toBeInTheDocument();
    expect(screen.getByText(/0 notifications récentes affichées sur 205/)).toBeInTheDocument();
  });
});
