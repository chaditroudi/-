import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
  qty: number;
}

const rows: Row[] = [
  { id: 'b', name: 'Banane', qty: 30 },
  { id: 'a', name: 'Amande', qty: 10 },
  { id: 'c', name: 'Cerise', qty: 20 },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Nom', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'qty', header: 'Quantité', cell: (r) => r.qty, sortValue: (r) => r.qty, align: 'right' },
  { id: 'actions', header: 'Actions', cell: () => <button>Action</button> },
];

function bodyOrder(): string[] {
  const table = screen.getByRole('table');
  const bodyRows = within(table).getAllByRole('row').slice(1); // drop header
  return bodyRows.map((tr) => within(tr).getAllByRole('cell')[0].textContent ?? '');
}

describe('DataTable', () => {
  it('renders every row and column in source order by default', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    expect(bodyOrder()).toEqual(['Banane', 'Amande', 'Cerise']);
    expect(screen.getAllByRole('button', { name: 'Action' })).toHaveLength(3);
  });

  it('sorts ascending then descending when a sortable header is clicked', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    const nameHeader = screen.getByRole('button', { name: /Nom/ });

    fireEvent.click(nameHeader);
    expect(bodyOrder()).toEqual(['Amande', 'Banane', 'Cerise']);

    fireEvent.click(nameHeader);
    expect(bodyOrder()).toEqual(['Cerise', 'Banane', 'Amande']);
  });

  it('sorts numeric columns numerically, not lexically', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    fireEvent.click(screen.getByRole('button', { name: /Quantité/ }));
    expect(bodyOrder()).toEqual(['Amande', 'Cerise', 'Banane']); // 10, 20, 30
  });

  it('does not make a column without sortValue clickable', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    // "Actions" header is plain text, not a sort button.
    expect(screen.queryByRole('button', { name: /^Actions/ })).toBeNull();
  });

  it('renders the empty state when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        emptyState={<p>Aucun lot trouvé</p>}
      />,
    );
    expect(screen.getByText('Aucun lot trouvé')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a busy skeleton table while loading', () => {
    render(
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} isLoading loadingRows={3} />,
    );
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(bodyOrder()).toHaveLength(3);
  });

  it('fires onRowClick with the clicked row', () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText('Amande'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });
});
