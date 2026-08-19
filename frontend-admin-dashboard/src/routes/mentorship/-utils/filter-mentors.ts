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
