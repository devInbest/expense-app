import type { ReactNode } from 'react';
import type { PagePagination } from '@expense/shared';
import Skeleton from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data?: T[];
  rowKey?: (row: T, index: number) => string | number;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  pagination?: PagePagination & { onPageChange: (page: number) => void };
  /** Toolbar above the table (search, filters). */
  header?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

const alignClass = (align?: Column<unknown>['align']) =>
  align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

const defaultRowKey = (row: unknown, index: number) => (row as { _id?: string })?._id ?? index;

/** Table with loading and empty states, row clicks and page-based pagination. */
export default function DataTable<T>({
  columns,
  data = [],
  rowKey = defaultRowKey,
  loading = false,
  skeletonRows = 5,
  emptyTitle = 'No records found',
  emptyDescription,
  pagination,
  header,
  onRowClick,
  className = '',
}: Props<T>) {
  return (
    <div className={`card overflow-hidden ${className}`.trim()}>
      {header && <div className="p-4 border-b border-gray-100 flex flex-wrap items-end justify-between gap-3">{header}</div>}
      {loading ? (
        <div className="p-6 space-y-4">
          {Array.from({ length: skeletonRows }).map((_, row) => (
            <div key={row} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
              {columns.map((col, i) => (
                <Skeleton key={col.key} className={`h-4 ${i === columns.length - 1 ? 'w-16' : 'flex-1'}`} />
              ))}
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16">
          <p className="company-empty-title">{emptyTitle}</p>
          {emptyDescription && <p className="company-empty-desc">{emptyDescription}</p>}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="!text-base" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={col.width ? { width: col.width } : undefined} className={alignClass(col.align)}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowKey(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`whitespace-nowrap ${alignClass(col.align)} ${col.className ?? ''}`.trim()}>
                      {col.render ? col.render(row, rowIndex) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="company-form-section-hint">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-xs py-1.5 px-3"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary text-xs py-1.5 px-3"
              disabled={pagination.page >= pagination.pages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
