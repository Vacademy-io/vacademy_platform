import { describe, expect, it } from 'vitest';
import { normalizePage } from '@/routes/mentorship/-utils/page-response';

/**
 * A Spring `Page` response names its envelope from Page's getters (camelCase) while
 * the DTOs inside `content` are snake_case. Reading `total_elements` off the
 * envelope returned undefined, and `(total_elements ?? 0) === 0` then rendered a
 * populated mentor list as "No mentors yet". These pin both spellings.
 */
describe('normalizePage', () => {
    it('reads the camelCase envelope a raw Spring Page actually sends', () => {
        const page = normalizePage<{ id: string }>({
            content: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
            totalElements: 3,
            totalPages: 1,
            number: 0,
            size: 20,
        });

        expect(page.content).toHaveLength(3);
        expect(page.total_elements).toBe(3);
        expect(page.total_pages).toBe(1);
    });

    it('still reads a snake_case envelope, so a wrapped DTO response keeps working', () => {
        const page = normalizePage<{ id: string }>({
            content: [{ id: 'm1' }],
            total_elements: 9,
            total_pages: 5,
            number: 2,
            size: 1,
        });

        expect(page.total_elements).toBe(9);
        expect(page.total_pages).toBe(5);
        expect(page.number).toBe(2);
    });

    it('never reports zero while it is carrying rows — the bug this fixes', () => {
        // Envelope totals missing entirely: the count must come from the content.
        const page = normalizePage<{ id: string }>({ content: [{ id: 'm1' }, { id: 'm2' }] });

        expect(page.total_elements).toBe(2);
        expect(page.total_pages).toBe(1);
    });

    it('reports a genuinely empty page as empty', () => {
        const page = normalizePage<{ id: string }>({ content: [], totalElements: 0, totalPages: 0 });

        expect(page.content).toEqual([]);
        expect(page.total_elements).toBe(0);
        expect(page.total_pages).toBe(0);
    });

    it('survives a null, undefined or malformed body instead of throwing', () => {
        for (const bad of [null, undefined, {}, { content: 'not-an-array' }, 42]) {
            const page = normalizePage<{ id: string }>(bad);
            expect(page.content).toEqual([]);
            expect(page.total_elements).toBe(0);
        }
    });

    it('keeps a zero total when the server explicitly says zero', () => {
        // ?? must not treat an explicit 0 as missing and fall back to content length.
        const page = normalizePage<{ id: string }>({ content: [], total_elements: 0 });
        expect(page.total_elements).toBe(0);
    });
});
