// Per-tour completion flags, scoped to the institute. We store one flag per
// tour id so users see each tour only once but can replay any of them later
// from the help menu. Scoping by institute keeps flags isolated across studios
// signed in on the same browser profile.

export type VimTourId =
    | 'vim-dashboard'
    | 'vim-composer'
    | 'vim-brand-kit'
    | 'vim-avatar'
    | 'vim-editor';

const STORAGE_PREFIX = 'vim_tour_seen';

const key = (tourId: VimTourId, instituteId: string | undefined) =>
    `${STORAGE_PREFIX}:${instituteId ?? 'anon'}:${tourId}`;

export function isTourSeen(tourId: VimTourId, instituteId: string | undefined): boolean {
    if (typeof window === 'undefined') return true;
    try {
        return window.localStorage.getItem(key(tourId, instituteId)) === '1';
    } catch {
        return true;
    }
}

export function markTourSeen(tourId: VimTourId, instituteId: string | undefined): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key(tourId, instituteId), '1');
    } catch {
        // ignore storage errors (private browsing, quota, etc.)
    }
}

export function clearTourSeen(tourId: VimTourId, instituteId: string | undefined): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key(tourId, instituteId));
    } catch {
        // ignore
    }
}
