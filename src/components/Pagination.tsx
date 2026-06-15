import type { ReactNode } from 'react';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type Props = {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-gray-500 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-800 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

export default function Pagination({
  pagination,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className = '',
}: Props) {
  const { page, limit, total, total_pages } = pagination;
  if (total <= 0) return null;

  const safeTotalPages = total_pages > 0 ? total_pages : 1;
  const canGoPrev = page > 1;
  const canGoNext = page < safeTotalPages;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        <NavButton label="First page" disabled={!canGoPrev} onClick={() => onPageChange(1)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 2.5L6.5 7L3 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.5 2.5V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </NavButton>

        <NavButton label="Previous page" disabled={!canGoPrev} onClick={() => onPageChange(page - 1)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavButton>

        <span className="mx-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded border border-gray-300 bg-white px-2 text-sm font-semibold text-gray-900">
          {page}
        </span>

        <NavButton label="Next page" disabled={!canGoNext} onClick={() => onPageChange(page + 1)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </NavButton>

        <NavButton label="Last page" disabled={!canGoNext} onClick={() => onPageChange(safeTotalPages)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M11 2.5L7.5 7L11 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.5 2.5V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </NavButton>

        <span className="ml-3 text-gray-600">
          Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
          <span className="font-semibold text-gray-900">{safeTotalPages}</span>
        </span>

        <span className="mx-3 hidden h-4 w-px bg-gray-300 sm:inline-block" aria-hidden />

        <span className="text-gray-600">
          Total: <span className="font-semibold text-gray-900">{total}</span>
        </span>
      </div>

      {onLimitChange && (
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={limit}
            onChange={e => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-8 rounded border border-gray-300 bg-white pl-2.5 pr-7 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
