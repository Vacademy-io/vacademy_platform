import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * LeadPagination — the premium numbered pager used by the Recent Leads table:
 * "‹ Prev  1 2 … N  Next ›" with a windowed page list and an outlined active
 * page. Purpose-built (the platform MyPagination renders a different "1 … N" +
 * "Go to" layout that can't reproduce this) but token + Phosphor compliant.
 */

interface LeadPaginationProps {
    /** Zero-indexed current page. */
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

/** Build the 1-indexed page list with ellipsis markers for gaps. */
const buildPages = (current: number, total: number): (number | 'left' | 'right')[] => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | 'left' | 'right')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('left');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push('right');
    pages.push(total);
    return pages;
};

const BTN =
    'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors';

export function LeadPagination({ currentPage, totalPages, onPageChange }: LeadPaginationProps) {
    if (totalPages <= 1) return null;
    const current = currentPage + 1; // 1-indexed for display
    const pages = buildPages(current, totalPages);
    const atStart = currentPage <= 0;
    const atEnd = currentPage >= totalPages - 1;

    return (
        <nav
            role="navigation"
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-end gap-1 text-neutral-600"
        >
            <button
                type="button"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={atStart}
                className={cn(
                    BTN,
                    'hover:bg-neutral-100',
                    atStart && 'pointer-events-none opacity-40'
                )}
            >
                <CaretLeft className="size-4" />
                Prev
            </button>
            {pages.map((p, i) =>
                p === 'left' || p === 'right' ? (
                    <span
                        key={`${p}-${i}`}
                        className="inline-flex size-9 items-center justify-center text-neutral-400"
                    >
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        type="button"
                        onClick={() => onPageChange(p - 1)}
                        aria-current={p === current ? 'page' : undefined}
                        className={cn(
                            BTN,
                            p === current
                                ? 'border border-primary-500 text-primary-600'
                                : 'hover:bg-neutral-100'
                        )}
                    >
                        {p}
                    </button>
                )
            )}
            <button
                type="button"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={atEnd}
                className={cn(
                    BTN,
                    'hover:bg-neutral-100',
                    atEnd && 'pointer-events-none opacity-40'
                )}
            >
                Next
                <CaretRight className="size-4" />
            </button>
        </nav>
    );
}
