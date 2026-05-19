/**
 * Sub-org URL slug helpers for the institute-admin deep route
 * `/manage-custom-teams/sub-orgs/$subOrgSlug`.
 *
 * Slug shape: pure name-slug — e.g. `svm-school`. Two sub-orgs under the same
 * institute won't share a display name, so a name-only slug is unique within
 * the scope this route ever sees (the institute's full sub-org list).
 */

function slugifyName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // strip diacritics
        .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphens
        .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
        .replace(/-{2,}/g, '-') // collapse runs of hyphens
        || 'sub-org';
}

export interface SubOrgLike {
    id: string;
    name?: string;
}

/** Build a shareable URL slug for a sub-org. */
export function buildSubOrgSlug(subOrg: SubOrgLike): string {
    return slugifyName(subOrg.name || subOrg.id || 'sub-org');
}

/**
 * Resolve a slug back to a sub-org from a list of candidates by matching the
 * slugified name. Returns the first candidate whose name slugifies to the same
 * value (case-insensitive).
 */
export function resolveSubOrgBySlug<T extends SubOrgLike>(
    slug: string | undefined | null,
    candidates: T[]
): T | undefined {
    if (!slug || candidates.length === 0) return undefined;
    const want = slug.toLowerCase();
    return candidates.find(
        (c) => slugifyName(c.name || c.id) === want
    );
}
