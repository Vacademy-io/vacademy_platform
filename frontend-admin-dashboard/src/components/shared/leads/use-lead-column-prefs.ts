import { useCallback, useState } from 'react';

/** A LeadTable column the user is allowed to show/hide, in display order. */
export interface LeadColumnToggle {
    id: string;
    label: string;
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
