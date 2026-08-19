/**
 * Chat timestamps are recorded in UTC, but service builds before the Instant switch serialise
 * them without a zone marker — and `new Date('2026-08-19T08:47:03')` reads a bare value as
 * *local* time, so a 2:17 PM IST message rendered as 8:47 AM. Force UTC when the marker is
 * missing; values that already carry one (including our optimistic `toISOString()` echoes)
 * pass through untouched.
 */
export const toUtcDate = (raw: string | null | undefined): Date | null => {
    if (!raw) return null;
    const hasZone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
    const date = new Date(hasZone ? raw : `${raw.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? null : date;
};
