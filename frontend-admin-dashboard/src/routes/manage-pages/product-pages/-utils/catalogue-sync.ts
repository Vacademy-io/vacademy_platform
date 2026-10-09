import type { ProductPageResponse } from '../-types/product-page-types';

/**
 * Reading the catalogue-sync response, defensively: the page may come spread
 * at the top level (the documented shape) or nested under `page`, and the
 * added / deactivated figures may be counts or lists. Nothing here trusts the
 * shape — a missing piece becomes 0 / [] / null, never a crash.
 */

/** One catalogue course version the sync did not add, and why. */
export interface CatalogueSyncSkip {
    package_session_id: string;
    reason: string;
}

/**
 * POST /v1/product-page/{id}/sync-catalogue: the admin page response plus a
 * summary of what changed (Knowledge Streams spec §7). `added` / `deactivated`
 * may arrive as counts or as lists; parseSyncResponse() reads either.
 */
export interface CatalogueSyncResponse extends Partial<ProductPageResponse> {
    added?: number | unknown[];
    deactivated?: number | unknown[];
    skipped?: CatalogueSyncSkip[];
    warnings?: (string | { message?: string })[];
    /** Some servers nest the page instead of spreading it. */
    page?: ProductPageResponse;
}

export interface CatalogueSyncResult {
    /** The page after the sync, or null when the response did not carry a usable one (refetch it). */
    page: ProductPageResponse | null;
    added: number;
    deactivated: number;
    skipped: CatalogueSyncSkip[];
    warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const countOf = (v: unknown): number =>
    Array.isArray(v) ? v.length : typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

const asPage = (v: unknown): ProductPageResponse | null =>
    isRecord(v) && typeof v.id === 'string' && v.id && Array.isArray(v.mappings) ? (v as unknown as ProductPageResponse) : null;

export const parseSyncResponse = (data: unknown): CatalogueSyncResult => {
    const raw = isRecord(data) ? data : {};
    const page = asPage(raw.page) ?? asPage(raw.product_page) ?? asPage(raw);
    const skipped: CatalogueSyncSkip[] = (Array.isArray(raw.skipped) ? raw.skipped : [])
        .filter(isRecord)
        .map((s) => ({
            package_session_id: String(s.package_session_id ?? s.packageSessionId ?? ''),
            reason: String(s.reason ?? '').trim() || 'Not added',
        }));
    const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
        .map((w) => (typeof w === 'string' ? w : isRecord(w) && typeof w.message === 'string' ? w.message : ''))
        .map((w) => w.trim())
        .filter(Boolean);
    return { page, added: countOf(raw.added), deactivated: countOf(raw.deactivated), skipped, warnings };
};

/** Skipped versions grouped by reason, most common first (ties keep first-seen order). */
export const groupSkipsByReason = (skipped: CatalogueSyncSkip[]): { reason: string; count: number }[] => {
    const counts = new Map<string, number>();
    for (const s of skipped) counts.set(s.reason, (counts.get(s.reason) || 0) + 1);
    return [...counts.entries()]
        .map(([reason, count], index) => ({ reason, count, index }))
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .map(({ reason, count }) => ({ reason, count }));
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One line for a toast or a summary header: "Added 12 courses · switched off 2 · 3 not added". */
export const syncSummaryLine = (r: Pick<CatalogueSyncResult, 'added' | 'deactivated' | 'skipped'>): string => {
    const parts = [
        r.added ? `Added ${plural(r.added, 'course version', 'course versions')}` : 'Nothing new to add',
    ];
    if (r.deactivated) parts.push(`switched off ${r.deactivated} no longer in the catalogue`);
    if (r.skipped.length) parts.push(`${r.skipped.length} not added`);
    return parts.join(' · ');
};
