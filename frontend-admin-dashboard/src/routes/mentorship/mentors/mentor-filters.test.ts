import { describe, expect, it } from 'vitest';
import {
    applyMentorFilters,
    DEFAULT_MENTOR_FILTERS,
    isDefaultMentorFilters,
    type MentorFilters,
} from '@/routes/mentorship/-utils/filter-mentors';
import type { MentorDTO } from '@/routes/mentorship/-types/mentorship-types';

const mentor = (over: Partial<MentorDTO> = {}): MentorDTO => ({
    id: 'm1',
    institute_id: 'inst-1',
    user_id: 'u1',
    display_name: 'Asha Nair',
    status: 'ACTIVE',
    ...over,
});

const filters = (over: Partial<MentorFilters> = {}): MentorFilters => ({
    ...DEFAULT_MENTOR_FILTERS,
    ...over,
});

/**
 * The mentor list swaps from the server-paginated page to a client filter the moment
 * anything is narrowed, so "is anything narrowed" and "what survives" both have to be
 * exactly right — get the first wrong and the list silently paginates the wrong set.
 */
describe('mentor list filters', () => {
    describe('isDefaultMentorFilters', () => {
        it('is true for the untouched filter set', () => {
            expect(isDefaultMentorFilters(DEFAULT_MENTOR_FILTERS)).toBe(true);
        });

        it('treats whitespace-only search as no search', () => {
            expect(isDefaultMentorFilters(filters({ search: '   ' }))).toBe(true);
        });

        it.each([
            ['status', filters({ status: ['inactive'] })],
            ['discoverable', filters({ discoverable: ['listed'] })],
            ['capacity', filters({ capacity: ['full'] })],
            ['search', filters({ search: 'asha' })],
        ])('is false once %s is set', (_label, f) => {
            expect(isDefaultMentorFilters(f)).toBe(false);
        });
    });

    describe('applyMentorFilters', () => {
        const rows = [
            mentor({ id: 'active-listed', status: 'ACTIVE', is_discoverable: true, booking_page_slug: 'a' }),
            mentor({ id: 'inactive', status: 'INACTIVE', is_discoverable: false, booking_page_slug: 'b' }),
            mentor({ id: 'full', status: 'ACTIVE', at_capacity: true, booking_page_slug: 'c' }),
            mentor({ id: 'no-booking', status: 'ACTIVE', booking_page_slug: null }),
        ];

        it('returns everything when nothing is narrowed', () => {
            expect(applyMentorFilters(rows, DEFAULT_MENTOR_FILTERS)).toHaveLength(4);
        });

        it('treats a missing status as ACTIVE rather than dropping the row', () => {
            const noStatus = [mentor({ id: 'x', status: '' })];
            expect(applyMentorFilters(noStatus, filters({ status: ['active'] }))).toHaveLength(1);
            expect(applyMentorFilters(noStatus, filters({ status: ['inactive'] }))).toHaveLength(0);
        });

        it('narrows by status', () => {
            const out = applyMentorFilters(rows, filters({ status: ['inactive'] }));
            expect(out.map((m) => m.id)).toEqual(['inactive']);
        });

        it('ORs the values within one facet', () => {
            // Ticking both is the same as ticking neither — that equivalence is what
            // makes "empty means all" safe.
            const both = applyMentorFilters(rows, filters({ status: ['active', 'inactive'] }));
            expect(both).toHaveLength(rows.length);
        });

        it('narrows by learner visibility', () => {
            const out = applyMentorFilters(rows, filters({ discoverable: ['listed'] }));
            expect(out.map((m) => m.id)).toEqual(['active-listed']);
        });

        it('treats a missing is_discoverable as hidden, not as listed', () => {
            const out = applyMentorFilters(rows, filters({ discoverable: ['hidden'] }));
            expect(out.map((m) => m.id)).toEqual(['inactive', 'full', 'no-booking']);
        });

        it('separates mentors at their limit from mentors with room', () => {
            expect(
                applyMentorFilters(rows, filters({ capacity: ['full'] })).map((m) => m.id)
            ).toEqual(['full']);
            expect(
                applyMentorFilters(rows, filters({ capacity: ['available'] })).map((m) => m.id)
            ).toEqual(['active-listed', 'inactive', 'no-booking']);
        });

        it('finds mentors nobody can book because they have no booking page', () => {
            const out = applyMentorFilters(rows, filters({ capacity: ['no-booking'] }));
            expect(out.map((m) => m.id)).toEqual(['no-booking']);
        });

        it('a mentor with room AND no booking page matches either capacity bucket', () => {
            // The buckets overlap on purpose: "no booking page" is a separate fact from
            // whether they have capacity, so the row must appear under both.
            const both = applyMentorFilters(rows, filters({ capacity: ['available', 'no-booking'] }));
            expect(both.map((m) => m.id)).toEqual(['active-listed', 'inactive', 'no-booking']);
        });

        it('ANDs across facets', () => {
            const out = applyMentorFilters(rows, filters({ status: ['active'], capacity: ['full'] }));
            expect(out.map((m) => m.id)).toEqual(['full']);
        });

        it('combines search with the other filters rather than replacing them', () => {
            const out = applyMentorFilters(
                [
                    mentor({ id: 'keep', display_name: 'Asha Nair', status: 'ACTIVE' }),
                    mentor({ id: 'wrong-status', display_name: 'Asha Verma', status: 'INACTIVE' }),
                    mentor({ id: 'wrong-name', display_name: 'Ravi Kumar', status: 'ACTIVE' }),
                ],
                filters({ search: 'asha', status: ['active'] })
            );
            expect(out.map((m) => m.id)).toEqual(['keep']);
        });
    });
});
