import { useCallback, useState } from 'react';

/** A table column the user can show/hide (and, where enabled, drag into order). */
export interface LeadColumnToggle {
    id: string;
    label: string;
    /**
     * Structural columns that carry the row's identity and can't be switched off (their
     * checkbox renders ticked and disabled). They can still be dragged into a new position.
     */
    locked?: boolean;
}

/**
 * The LeadTable columns a user may show/hide, in display order. Mirrors the
 * gating in LeadTable's own column list: the ops columns appear only when the
 * lead-ops feature is on, and the score column only when score display is on.
 * The Lead-name column is intentionally omitted — it is always shown.
 */
export function buildLeadColumnToggles(showOps: boolean, showScore: boolean): LeadColumnToggle[] {
    const cols: LeadColumnToggle[] = [
        { id: 'contact', label: 'Contact' },
        { id: 'source', label: 'Lead source' },
    ];
    if (showOps) cols.push({ id: 'status', label: 'Lead status' });
    if (showScore) cols.push({ id: 'score', label: 'Lead score' });
    if (showOps) {
        cols.push(
            { id: 'tier', label: 'Tier' },
            { id: 'reachout', label: 'Reach out in' },
            { id: 'followup', label: 'Follow up at' },
            { id: 'owner', label: 'Lead owner' },
            { id: 'activity', label: 'Activity' }
        );
    }
    cols.push({ id: 'submitted', label: 'Submitted' });
    return cols;
}

/**
 * Per-user "Manage Column" preferences for the shared LeadTable, persisted to
 * localStorage so a show/hide choice survives reloads and navigation (the state
 * used to be ephemeral and reset on every mount).
 *
 * Keyed per surface via `storageKey` (e.g. Recent Leads vs. the audience lead
 * list) so each table keeps its own layout while sharing this mechanism.
 * `defaultHidden` seeds the set the first time a surface is opened (before the
 * user has expressed any preference); pass a stable reference.
 */
export function useLeadColumnPrefs(storageKey: string, defaultHidden: string[] = []) {
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
                }
            }
        } catch {
            /* corrupt or unavailable storage — fall back to the defaults below */
        }
        return new Set(defaultHidden);
    });

    const persist = useCallback(
        (next: Set<string>) => {
            try {
                localStorage.setItem(storageKey, JSON.stringify([...next]));
            } catch {
                /* storage blocked/full — keep the in-memory choice, just don't persist */
            }
        },
        [storageKey]
    );

    const toggleColumn = useCallback(
        (id: string) => {
            setHiddenColumns((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                persist(next);
                return next;
            });
        },
        [persist]
    );

    const resetColumns = useCallback(() => {
        const next = new Set(defaultHidden);
        setHiddenColumns(next);
        persist(next);
    }, [defaultHidden, persist]);

    return { hiddenColumns, toggleColumn, resetColumns };
}

/**
 * Per-user column ORDER for a table, persisted to localStorage beside the show/hide
 * preference above. Kept as a separate hook (and a separate storage key) so a surface can
 * adopt reordering without touching how it stores visibility.
 *
 * The stored value is a plain id list. It is never trusted to be complete or current —
 * see `orderColumnIds` for how it is reconciled against the columns that actually exist.
 */
export function useColumnOrderPrefs(storageKey: string) {
    const [columnOrder, setColumnOrderState] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.filter((x): x is string => typeof x === 'string');
                }
            }
        } catch {
            /* corrupt or unavailable storage — fall back to the natural order */
        }
        return [];
    });

    const setColumnOrder = useCallback(
        (next: string[]) => {
            setColumnOrderState(next);
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                /* storage blocked/full — keep the in-memory order, just don't persist */
            }
        },
        [storageKey]
    );

    const resetColumnOrder = useCallback(() => setColumnOrder([]), [setColumnOrder]);

    return { columnOrder, setColumnOrder, resetColumnOrder };
}

/**
 * Reconcile a saved order against the columns a table currently has.
 *
 * Saved ids that no longer exist are dropped, and columns the saved order has never seen
 * (a newly shipped column, or one that only appears for some institutes) keep their natural
 * position relative to the saved neighbour they follow — so adding a column doesn't shove it
 * to the end of every admin's layout, and an empty saved order is simply the natural order.
 */
export function orderColumnIds(naturalIds: string[], savedOrder: string[]): string[] {
    if (savedOrder.length === 0) return naturalIds;

    const saved = new Set(savedOrder);
    const known = savedOrder.filter((id) => naturalIds.includes(id));
    if (known.length === 0) return naturalIds;

    // Walk the natural list, emitting each unsaved column right after whichever saved
    // column precedes it naturally (or at the very front when nothing does).
    const trailing: string[][] = known.map(() => []);
    const leading: string[] = [];
    let anchor = -1;
    naturalIds.forEach((id) => {
        if (saved.has(id)) {
            const idx = known.indexOf(id);
            if (idx >= 0) anchor = idx;
            return;
        }
        if (anchor < 0) leading.push(id);
        else trailing[anchor]!.push(id);
    });

    return [...leading, ...known.flatMap((id, i) => [id, ...trailing[i]!])];
}
