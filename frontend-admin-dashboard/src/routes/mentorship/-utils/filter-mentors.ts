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

/** The non-text filters the mentor list offers. `'all'` means "don't narrow on this". */
export interface MentorFilters {
    search: string;
    status: 'all' | 'active' | 'inactive';
    discoverable: 'all' | 'listed' | 'hidden';
    capacity: 'all' | 'available' | 'full' | 'no-booking';
}

export const DEFAULT_MENTOR_FILTERS: MentorFilters = {
    search: '',
    status: 'all',
    discoverable: 'all',
    capacity: 'all',
};

/** True when nothing is narrowed — the caller can then use the server-paginated list. */
export function isDefaultMentorFilters(f: MentorFilters): boolean {
    return (
        f.search.trim() === '' &&
        f.status === 'all' &&
        f.discoverable === 'all' &&
        f.capacity === 'all'
    );
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

    if (filters.status !== 'all') {
        const wantActive = filters.status === 'active';
        rows = rows.filter(
            (m) => ((m.status || 'ACTIVE').toUpperCase() === 'ACTIVE') === wantActive
        );
    }

    if (filters.discoverable !== 'all') {
        const wantListed = filters.discoverable === 'listed';
        rows = rows.filter((m) => !!m.is_discoverable === wantListed);
    }

    switch (filters.capacity) {
        case 'available':
            rows = rows.filter((m) => !m.at_capacity);
            break;
        case 'full':
            rows = rows.filter((m) => !!m.at_capacity);
            break;
        case 'no-booking':
            rows = rows.filter((m) => !m.booking_page_slug);
            break;
        default:
            break;
    }

    return rows;
}
