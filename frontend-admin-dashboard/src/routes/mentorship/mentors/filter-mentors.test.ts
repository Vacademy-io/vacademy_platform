import { describe, expect, it } from 'vitest';
import { filterMentors } from '@/routes/mentorship/-utils/filter-mentors';
import type { MentorDTO } from '@/routes/mentorship/-types/mentorship-types';

const mentor = (over: Partial<MentorDTO>): MentorDTO => ({
    id: 'm',
    institute_id: 'i',
    user_id: 'u',
    status: 'ACTIVE',
    ...over,
});

const list = [
    mentor({ id: 'm1', display_name: 'Dr. Neeraj', title: 'Doctor', email: 'neeraj@vacademy.io' }),
    mentor({
        id: 'm2',
        display_name: 'ram singh',
        email: 'ramsingh@vidyayatan.com',
        expertise_tags: ['Exam strategy'],
    }),
    mentor({ id: 'm3', name: 'TESTING HOLISTIC' }),
];

describe('filterMentors', () => {
    it('returns everything for an empty or whitespace query', () => {
        expect(filterMentors(list, '')).toHaveLength(3);
        expect(filterMentors(list, '   ')).toHaveLength(3);
    });

    it('matches the display name, case-insensitively', () => {
        expect(filterMentors(list, 'neeraj').map((m) => m.id)).toEqual(['m1']);
        expect(filterMentors(list, 'NEERAJ').map((m) => m.id)).toEqual(['m1']);
    });

    it('matches an expertise tag, which is how admins search by topic', () => {
        expect(filterMentors(list, 'exam').map((m) => m.id)).toEqual(['m2']);
    });

    it('matches on any substring, including inside an email domain', () => {
        // Documents the behaviour: search is substring-based, so 'vidya' finds the
        // mentor whose address contains it. Surprising only if you expect prefixes.
        expect(filterMentors(list, 'vidya').map((m) => m.id)).toEqual(['m2']);
    });

    it('matches title and email too', () => {
        expect(filterMentors(list, 'doctor').map((m) => m.id)).toEqual(['m1']);
        expect(filterMentors(list, 'vidyayatan').map((m) => m.id)).toEqual(['m2']);
    });

    it('falls back to the auth-hydrated name when there is no display name', () => {
        expect(filterMentors(list, 'holistic').map((m) => m.id)).toEqual(['m3']);
    });

    it('returns nothing when there is no match, rather than everything', () => {
        expect(filterMentors(list, 'zzz')).toEqual([]);
    });

    it('tolerates mentors with mostly-missing fields', () => {
        expect(() => filterMentors([mentor({ id: 'bare' })], 'anything')).not.toThrow();
    });
});
