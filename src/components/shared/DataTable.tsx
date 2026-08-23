import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * DataTable — the shared, density-aware table primitive (UX Phase 0 · P0).
 *
 * Wraps the existing shadcn `Table` parts with a column-definition API so the
 * many hand-rolled tables across the app converge on one behaviour: consistent
 * density, client-side sorting, and shared loading / empty states. It changes
 * presentation only — sorting and row rendering are pure, so adopting it never
 * alters a screen's data, actions, or business rules.
 */

export type SortDirection = 'asc' | 'desc';
export type DataTableDensity = 'compact' | 'comfortable' | 'spacious';

export interface DataTableColumn<T> {
  /** Stable identifier, also used as the sort key. */
  id: string;
  header: React.ReactNode;
  /** Renders the cell for a row. */
  cell: (row: T) => React.ReactNode;
  /**
   * Return a comparable value to make the column sortable. Omit for columns
   * that should not be sortable (e.g. an actions column).
   */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: 'left' | 'right' | 'center';
  /** Extra className for the body cell. */
  className?: string;
  /** Extra className for the header cell. */
  headClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  density?: DataTableDensity;
  isLoading?: boolean;
  /** Skeleton row count while loading. */
  loadingRows?: number;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  initialSort?: { columnId: string; direction: SortDirection };
  caption?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const DENSITY_CELL: Record<DataTableDensity, string> = {
  compact: 'px-3 py-1.5',
  comfortable: 'px-4 py-3',
  spacious: 'px-4 py-4',
};

const DENSITY_HEAD: Record<DataTableDensity, string> = {
  compact: 'h-9 px-3',
  comfortable: 'h-11 px-4',
  spacious: 'h-12 px-4',
};

const ALIGN: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function compare(a: unknown, b: unknown): number {
  // Nullish values always sort last, regardless of direction.
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  density = 'comfortable',
  isLoading = false,
  loadingRows = 5,
  emptyState,
  onRowClick,
  rowClassName,
  initialSort,
  caption,
  className,
  'aria-label': ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ columnId: string; direction: SortDirection } | null>(
    initialSort ?? null,
  );

  const cellPad = DENSITY_CELL[density];
  const headPad = DENSITY_HEAD[density];

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;
    // Stable sort: decorate with original index as a tiebreaker.
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const cmp = compare(col.sortValue!(a.row), col.sortValue!(b.row));
        return cmp !== 0 ? cmp * factor : a.index - b.index;
      })
      .map((d) => d.row);
  }, [rows, columns, sort]);

  const toggleSort = (columnId: string) => {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: 'asc' };
      return { columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  if (isLoading) {
    return (
      <Table className={className} aria-label={ariaLabel} aria-busy="true">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id} className={cn(headPad, col.headClassName)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: loadingRows }).map((_, r) => (
            <TableRow key={r}>
              {columns.map((col) => (
                <TableCell key={col.id} className={cellPad}>
                  <div className="skeleton h-4 w-full max-w-[140px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="rounded-lg border border-border/50 py-10 text-center text-muted-foreground">
        {emptyState ?? <p>Aucune donnée</p>}
      </div>
    );
  }

  return (
    <Table className={className} aria-label={ariaLabel}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => {
            const sortable = Boolean(col.sortValue);
            const active = sort?.columnId === col.id;
            const alignClass = col.align ? ALIGN[col.align] : 'text-left';
            return (
              <TableHead
                key={col.id}
                className={cn(headPad, alignClass, col.headClassName)}
                aria-sort={active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={cn(
                      'inline-flex select-none items-center gap-1 uppercase tracking-wider',
                      'transition-colors hover:text-foreground',
                      active ? 'text-foreground' : 'text-foreground/70',
                    )}
                  >
                    {col.header}
                    {active ? (
                      sort!.direction === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => {
          const id = getRowId(row);
          const clickable = Boolean(onRowClick);
          return (
            <TableRow
              key={id}
              className={cn(clickable && 'cursor-pointer', rowClassName?.(row))}
              onClick={clickable ? () => onRowClick!(row) : undefined}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(cellPad, col.align ? ALIGN[col.align] : undefined, col.className)}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
      {caption}
    </Table>
  );
}

export default DataTable;
