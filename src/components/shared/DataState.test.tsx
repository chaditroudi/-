import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/axiosClient';
import { DataState } from './DataState';

const refused = new ApiRequestError({ message: 'x', status: 403 });
const broken = new ApiRequestError({ message: 'x', status: 500 });

const secret = <p>Quarantaine : 12 lots</p>;

describe('DataState', () => {
  it('says a refused request is reserved, and shows no list', () => {
    render(<DataState source={{ error: refused }} data={undefined} what="les lots">{secret}</DataState>);
    expect(screen.getByText('Accès réservé')).toBeInTheDocument();
    expect(screen.queryByText(/Quarantaine/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aucun/)).not.toBeInTheDocument();
  });

  it('hides what was held from before when access is refused', () => {
    render(<DataState source={{ error: refused }} data={[{ id: 1 }]} what="les lots">{secret}</DataState>);
    expect(screen.queryByText(/Quarantaine/)).not.toBeInTheDocument();
  });

  it('offers no retry for a refusal', () => {
    render(<DataState source={{ error: refused, refetch: vi.fn() }} data={undefined} what="les lots">{secret}</DataState>);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });

  it('says a failure is not an empty list, and offers a retry', () => {
    const refetch = vi.fn();
    render(<DataState source={{ error: broken, refetch }} data={undefined} what="les lots">{secret}</DataState>);
    expect(screen.getByRole('alert')).toHaveTextContent("Ce n'est pas une liste vide");
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('shows the empty message only after a successful answer', () => {
    render(<DataState source={{}} data={[]} what="les lots" empty="Aucun lot en stock.">{secret}</DataState>);
    expect(screen.getByText('Aucun lot en stock.')).toBeInTheDocument();
  });

  it('keeps old data and says when it dates from', () => {
    const updatedAt = new Date(2026, 9, 31, 14, 2).getTime();
    render(<DataState source={{ error: broken, updatedAt }} data={[{ id: 1 }]} what="les lots">{secret}</DataState>);
    expect(screen.getByText(/Quarantaine/)).toBeInTheDocument();
    expect(screen.getByText(/Données de 14:02/)).toBeInTheDocument();
  });

  it('shows the data when all is well', () => {
    render(<DataState source={{}} data={[{ id: 1 }]} what="les lots">{secret}</DataState>);
    expect(screen.getByText(/Quarantaine/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('names what is loading', () => {
    render(<DataState source={{ isLoading: true }} data={undefined} what="les lots">{secret}</DataState>);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement : les lots');
  });
});
