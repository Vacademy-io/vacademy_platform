import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnChangeFn, RowSelectionState } from '@tanstack/react-table';

/**
 * Row selection that can span every page of a paginated table.
 *
 * The tables here keep selection per page, keyed by the row's index within that page. That is fine
 * for ticking a few rows, but it caps a "select everything" action at the ten rows currently on
 * screen: to message 400 learners you had to walk 40 pages. This adds a second mode — *all matching
 * rows* — that fetches every row for the active filters in one request and then tracks
 * **exclusions**, so unticking someone after "Select all" removes just that person instead of
 * collapsing back to one page.
 *
 * @param page           current (0-based) page number
 * @param pageRows       rows rendered on the current page, in display order
 * @param getId          stable id for a row; used to track exclusions across pages
 * @param totalElements  total rows matching the active filters, from the server
 * @param fetchAllMatching  fetches every matching row in one call (same filters as the table)
 * @param onError        called if that fetch fails, so the caller can toast in its own voice
 * @param resetKey       changes whenever the active filters/search change; clears the selection so a
 *                       bulk action can never run against rows the current filters no longer match
 */
export function useCrossPageSelection<T>({
    page,
    pageRows,
    getId,
    totalElements,
    fetchAllMatching,
    onError,
    resetKey,
}: {
    page: number;
    pageRows: T[];
    getId: (row: T) => string;
    totalElements: number;
    fetchAllMatching: () => Promise<T[]>;
    onError?: (error: unknown) => void;
    resetKey?: string;
}) {
    // Per-page mode: selection keyed by page, then by row index within that page.
    const [pageSelections, setPageSelections] = useState<Record<number, RowSelectionState>>({});
    const [rowsByPage, setRowsByPage] = useState<Record<number, T[]>>({});

    // All-matching mode: every row for the current filters, minus anything unticked since.
    const [allMatching, setAllMatching] = useState<T[] | null>(null);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [isSelectingAll, setIsSelectingAll] = useState(false);

    // Remember each visited page's rows so a selection made on page 2 still resolves to real rows
    // after the user pages away.
    useEffect(() => {
        if (!pageRows.length) return;
        setRowsByPage((prev) => ({ ...prev, [page]: pageRows }));
    }, [page, pageRows]);

    const isAllMode = allMatching !== null;

    const currentPageSelection: RowSelectionState = useMemo(() => {
        if (!isAllMode) return pageSelections[page] || {};
        // In all-mode the checkbox state is derived, not stored: everything on screen is ticked
        // except rows the user explicitly removed.
        const derived: RowSelectionState = {};
        pageRows.forEach((row, index) => {
            if (!excludedIds.has(getId(row))) derived[index] = true;
        });
        return derived;
    }, [isAllMode, pageSelections, page, pageRows, excludedIds, getId]);

    const onRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback(
        (updaterOrValue) => {
            const next =
                typeof updaterOrValue === 'function'
                    ? updaterOrValue(currentPageSelection)
                    : updaterOrValue;

            if (isAllMode) {
                setExcludedIds((prev) => {
                    const updated = new Set(prev);
                    pageRows.forEach((row, index) => {
                        if (next[index]) updated.delete(getId(row));
                        else updated.add(getId(row));
                    });
                    return updated;
                });
                return;
            }

            setPageSelections((prev) => ({ ...prev, [page]: next }));
        },
        [currentPageSelection, isAllMode, page, pageRows, getId]
    );

    const selectedRows: T[] = useMemo(() => {
        if (isAllMode) {
            return allMatching.filter((row) => !excludedIds.has(getId(row)));
        }
        return Object.entries(pageSelections).flatMap(([pageNumber, selection]) => {
            const rows = rowsByPage[Number(pageNumber)];
            if (!rows) return [];
            return Object.entries(selection)
                .filter(([, isSelected]) => isSelected)
                .map(([index]) => rows[Number(index)])
                .filter((row): row is T => row !== undefined);
        });
    }, [isAllMode, allMatching, excludedIds, pageSelections, rowsByPage, getId]);

    const reset = useCallback(() => {
        setPageSelections({});
        setAllMatching(null);
        setExcludedIds(new Set());
    }, []);

    // "Select all 400" captured 400 concrete rows. Narrow the filters afterwards and those rows are
    // no longer what the screen says is selected — sending to them would hit people the admin just
    // filtered out. Drop the selection whenever the filters change; re-selecting is one click.
    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (resetKey !== lastResetKey) {
        setLastResetKey(resetKey);
        if (allMatching !== null || Object.keys(pageSelections).length > 0) reset();
    }

    const selectAllMatching = useCallback(async () => {
        if (!totalElements) return;
        setIsSelectingAll(true);
        try {
            const rows = await fetchAllMatching();
            setAllMatching(rows);
            setExcludedIds(new Set());
            setPageSelections({});
        } catch (error) {
            onError?.(error);
        } finally {
            setIsSelectingAll(false);
        }
    }, [totalElements, fetchAllMatching, onError]);

    return {
        currentPageSelection,
        onRowSelectionChange,
        selectedRows,
        selectedCount: selectedRows.length,
        reset,
        selectAllMatching,
        isSelectingAll,
        /** True once something is selected but not yet everything the filters match. */
        canSelectAll: totalElements > 0 && selectedRows.length < totalElements,
        isAllMode,
    };
}
