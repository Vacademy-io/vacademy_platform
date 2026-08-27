import type { MentorDTO } from '../-types/mentorship-types';

/**
 * Mentor list search. Matches name, title, email and expertise tags, so an admin can
 * type what they remember rather than the exact display name.
 *
 * Searching deliberately runs over the FULL mentor list, not the current page: a
 * page-local filter would silently hide matches sitting on other pages, which reads
 * as "that mentor doesn't exist".
 */
export function filterMentors(mentors: MentorDTO[], search: string): MentorDTO[] {
    const query = search.trim().toLowerCase();
    if (!query) return mentors;
    return mentors.filter((m) =>
        [m.display_name, m.name, m.title, m.email, ...(m.expertise_tags ?? [])].some((field) =>
            (field ?? '').toLowerCase().includes(query)
        )
    );
}

/**
 * The non-text filters the mentor list offers.
 *
 * Each facet is a SET of accepted values. An empty array means "don't narrow on this",
 * which keeps "no filter" and "every option ticked" the same thing — the alternative
 * ('all' as a magic member) makes every consumer special-case it.
 *
 * Values are OR-ed within a facet and AND-ed across facets, which is what a reader
 * expects from "Active or Inactive" plus "At their limit".
 */
export interface MentorFilters {
    search: string;
    /** 'active' | 'inactive' */
    status: string[];
    /** 'listed' | 'hidden' */
    discoverable: string[];
    /** 'available' | 'full' | 'no-booking' */
    capacity: string[];
}

export const DEFAULT_MENTOR_FILTERS: MentorFilters = {
    search: '',
    status: [],
    discoverable: [],
    capacity: [],
};

/** True when nothing is narrowed — the caller can then use the server-paginated list. */
export function isDefaultMentorFilters(f: MentorFilters): boolean {
    return (
        f.search.trim() === '' &&
        f.status.length === 0 &&
        f.discoverable.length === 0 &&
        f.capacity.length === 0
    );
}

/** Is this mentor active? A missing status means active, as everywhere else. */
function isActive(m: MentorDTO): boolean {
    return (m.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
}

/** Which capacity buckets a mentor belongs to. A mentor can be in more than one. */
function capacityBuckets(m: MentorDTO): string[] {
    const buckets: string[] = [m.at_capacity ? 'full' : 'available'];
    if (!m.booking_page_slug) buckets.push('no-booking');
    return buckets;
}

/**
 * Apply every mentor-list filter at once.
 *
 * Like search, this runs over the FULL mentor list rather than the current page — a
 * page-local filter would report "no mentors are at capacity" while a mentor on page
 * two is, which is worse than no filter at all.
 *
 * `at_capacity` is trusted over recomputing from counts: the server knows about
 * assignments this client hasn't loaded, and an uncapped mentor is never full.
 */
export function applyMentorFilters(mentors: MentorDTO[], filters: MentorFilters): MentorDTO[] {
    let rows = filterMentors(mentors, filters.search);

    if (filters.status.length > 0) {
        rows = rows.filter((m) => filters.status.includes(isActive(m) ? 'active' : 'inactive'));
    }

    if (filters.discoverable.length > 0) {
        rows = rows.filter((m) =>
            filters.discoverable.includes(m.is_discoverable ? 'listed' : 'hidden')
        );
    }

    if (filters.capacity.length > 0) {
        rows = rows.filter((m) =>
            capacityBuckets(m).some((bucket) => filters.capacity.includes(bucket))
        );
    }

    return rows;
}
