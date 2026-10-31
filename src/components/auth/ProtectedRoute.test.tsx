import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

const auth = {
  user: null as Record<string, unknown> | null,
  isLoading: false,
  changePassword: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => auth }));

const renderRoute = () =>
  render(
    <MemoryRouter>
      <ProtectedRoute>
        <p>Écran de travail</p>
      </ProtectedRoute>
    </MemoryRouter>,
  );

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ProtectedRoute', () => {
  beforeEach(() => {
    auth.user = { id: 'u-1', email: 'a@b.c', must_change_password: true };
    auth.changePassword.mockReset();
  });

  it('shows the work screen to a normal account', () => {
    auth.user = { id: 'u-1', email: 'a@b.c' };
    renderRoute();
    expect(screen.getByText('Écran de travail')).toBeInTheDocument();
  });

  it('holds an account with a pending password change', () => {
    renderRoute();
    expect(screen.getByText('Changez votre mot de passe')).toBeInTheDocument();
    expect(screen.queryByText('Écran de travail')).not.toBeInTheDocument();
  });

  it('refuses a short password before calling the server', () => {
    renderRoute();
    fill('Mot de passe actuel', 'old-password');
    fill('Nouveau mot de passe', 'short');
    fill('Confirmer le nouveau mot de passe', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('au moins 10 caractères');
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('refuses a confirmation that differs', () => {
    renderRoute();
    fill('Mot de passe actuel', 'old-password');
    fill('Nouveau mot de passe', 'new-password-1');
    fill('Confirmer le nouveau mot de passe', 'new-password-2');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ne correspondent pas');
  });

  it('sends the change and shows a server refusal', async () => {
    auth.changePassword.mockRejectedValueOnce(new Error('Mot de passe incorrect.'));
    renderRoute();
    fill('Mot de passe actuel', 'wrong-password');
    fill('Nouveau mot de passe', 'new-password-1');
    fill('Confirmer le nouveau mot de passe', 'new-password-1');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Mot de passe incorrect.'));
    expect(auth.changePassword).toHaveBeenCalledWith('wrong-password', 'new-password-1');
  });
});
