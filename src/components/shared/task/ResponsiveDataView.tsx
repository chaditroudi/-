import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Shown as the card title on tablets and phones. Exactly one column should set it. */
  primary?: boolean;
  /** Hidden from cards to keep them short; still in the table. */
  tableOnly?: boolean;
  align?: 'start' | 'end';
}

/** The same rows as a table on desks (≥ 1024 px) and as tappable cards on tablets and phones.
 * Every column stays reachable: cards show all non-tableOnly columns and open the row for the rest. */
export function ResponsiveDataView<Row>({ rows, columns, rowKey, onOpen, actions, label, className }: {
  rows: Row[];
  columns: DataColumn<Row>[];
  rowKey: (row: Row) => string;
  onOpen?: (row: Row) => void;
  actions?: (row: Row) => ReactNode;
  label: string;
  className?: string;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.tableOnly);

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-xl border bg-card lg:block">
        <Table aria-label={label}>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow>
              {columns.map((c) => <TableHead key={c.id} className={cn(c.align === 'end' && 'text-end')}>{c.header}</TableHead>)}
              {actions && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)} className={cn(onOpen && 'cursor-pointer')} onClick={onOpen ? () => onOpen(row) : undefined}>
                {columns.map((c) => <TableCell key={c.id} className={cn(c.align === 'end' && 'text-end tabular-nums')}>{c.cell(row)}</TableCell>)}
                {actions && <TableCell onClick={(e) => e.stopPropagation()} className="whitespace-nowrap">{actions(row)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border bg-card shadow-sm">
            <button type="button" disabled={!onOpen} onClick={onOpen ? () => onOpen(row) : undefined}
              className="w-full space-y-2 p-4 text-start disabled:cursor-default">
              <div className="font-semibold">{primary.cell(row)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {secondary.map((c) => (
                  <div key={c.id} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{c.header}</dt>
                    <dd className="truncate">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </button>
            {actions && <div className="flex flex-wrap justify-end gap-2 border-t px-4 py-2">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
