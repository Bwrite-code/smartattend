import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Responsive data table (doc §51): proper <table> on desktop, stacked cards on
 * mobile when `mobileCard` is provided — tables never rely on horizontal
 * scrolling for critical content on phones.
 */
export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  mobileCard?: (row: T) => ReactNode;
  empty?: ReactNode;
  /** Shown instead of `empty` while a secondary load is in flight. */
  loadingNote?: string;
}

export function DataTable<T>({ columns, rows, keyOf, mobileCard, empty, loadingNote }: DataTableProps<T>) {
  if (rows.length === 0 && loadingNote) {
    return (
      <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> {loadingNote}
      </div>
    );
  }
  if (rows.length === 0 && empty) return <>{empty}</>;

  const table = (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={cn('whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={keyOf(row)} className="hover:bg-slate-50/70">
              {columns.map((c) => (
                <td key={c.header} className={cn('px-4 py-3 text-slate-700', c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">{table}</div>
      {/* Mobile */}
      <div className="divide-y divide-slate-100 md:hidden">
        {mobileCard
          ? rows.map((row) => <div key={keyOf(row)} className="px-4 py-3">{mobileCard(row)}</div>)
          : table}
      </div>
    </>
  );
}
