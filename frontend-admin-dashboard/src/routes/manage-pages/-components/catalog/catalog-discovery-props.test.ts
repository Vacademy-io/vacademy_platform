import { describe, expect, it } from 'vitest';
import {
    enableBadges,
    enableStreams,
    formatAmountList,
    moveItem,
    newQuickFilter,
    nextQuickFilterId,
    parseAmountList,
    positiveIntOrUndefined,
    readCourseLanguages,
    toggleBadgeType,
    toStreamKey,
    withQuickFilterKind,
} from './catalog-discovery-props';

describe('amount lists', () => {
    it('parses loose input into unique ascending positive amounts', () => {
        expect(parseAmountList('1000, 500  ₹750; -5, abc, 500')).toEqual([500, 750, 1000]);
        expect(parseAmountList('')).toEqual([]);
        expect(parseAmountList('1 2 3 4 5 6 7 8 9 10')).toHaveLength(8);
    });

    it('formats stored amounts back for the input', () => {
        expect(formatAmountList([500, 1000])).toBe('500, 1000');
        expect(formatAmountList(undefined)).toBe('');
        expect(formatAmountList([0, 'x', 300])).toBe('300');
    });
});

describe('keys and ids', () => {
    it('makes URL keys', () => {
        expect(toStreamKey(' Vedic Maths ')).toBe('vedic-maths');
        expect(toStreamKey('शिक्षा')).toBe('');
    });

    it('picks the first free quick-filter id', () => {
        expect(nextQuickFilterId([])).toBe('qf-1');
        expect(nextQuickFilterId([{ id: 'qf-2' }])).toBe('qf-3');
        expect(nextQuickFilterId([{ id: 'qf-2' }, { id: 'qf-3' }])).toBe('qf-4');
    });
});

describe('quick filters', () => {
    it('adds the first unused shortcut', () => {
        expect(newQuickFilter([])).toEqual({ id: 'qf-1', label: '', kind: 'popular' });
        const all = (['popular', 'new', 'free', 'bestseller'] as const).map((kind, i) => ({
            id: `qf-${i + 1}`,
            label: '',
            kind,
        }));
        expect(newQuickFilter(all)).toEqual({
            id: 'qf-5',
            label: '',
            kind: 'priceMax',
            value: 1000,
        });
    });

    it('gives a re-kinded filter a valid value', () => {
        const qf = { id: 'qf-1', label: 'Hindi', kind: 'popular' as const };
        expect(withQuickFilterKind(qf, 'language', [{ code: 'hi', label: 'Hindi' }])).toEqual({
            id: 'qf-1',
            label: 'Hindi',
            kind: 'language',
            value: 'hi',
        });
        expect(withQuickFilterKind({ ...qf, value: 500 }, 'priceMax', [])).toMatchObject({
            value: 500,
        });
        expect(withQuickFilterKind({ ...qf, kind: 'language', value: 'hi' }, 'new', [])).toEqual({
            id: 'qf-1',
            label: 'Hindi',
            kind: 'new',
        });
    });

    it('moves items within bounds only', () => {
        expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
        expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
        const list = ['a', 'b'];
        expect(moveItem(list, 0, -1)).toBe(list);
        expect(moveItem(list, 1, 1)).toBe(list);
    });
});

describe('defaults when switching a feature on', () => {
    it('streams keep earlier choices', () => {
        expect(enableStreams(undefined)).toEqual({
            source: 'folderLibrary',
            sticky: true,
            labelMode: 'title',
            enabled: true,
        });
        expect(enableStreams({ enabled: false, source: 'tags', items: [] })).toEqual({
            source: 'tags',
            sticky: true,
            labelMode: 'title',
            items: [],
            enabled: true,
        });
    });

    it('badges default to all four with the learner defaults', () => {
        expect(enableBadges(null)).toEqual({
            types: ['bestseller', 'popular', 'new', 'free'],
            newDays: 60,
            bestsellerTop: 3,
            max: 2,
            enabled: true,
        });
    });

    it('toggles badge types in priority order', () => {
        expect(toggleBadgeType(['free', 'new'], 'bestseller')).toEqual([
            'bestseller',
            'new',
            'free',
        ]);
        expect(toggleBadgeType(undefined, 'popular')).toEqual(['bestseller', 'new', 'free']);
    });
});

describe('site settings', () => {
    it('reads course languages with defaults', () => {
        expect(readCourseLanguages(undefined)).toEqual({
            enabled: false,
            languages: [
                { code: 'en', label: 'English' },
                { code: 'hi', label: 'Hindi' },
            ],
        });
        expect(
            readCourseLanguages({
                courseLanguages: {
                    enabled: true,
                    languages: [{ code: 'MR', label: 'Marathi' }, { label: 'x' }],
                },
            })
        ).toEqual({ enabled: true, languages: [{ code: 'mr', label: 'Marathi' }] });
    });

    it('reads positive whole numbers', () => {
        expect(positiveIntOrUndefined('30')).toBe(30);
        expect(positiveIntOrUndefined('2.9')).toBe(2);
        expect(positiveIntOrUndefined('0')).toBeUndefined();
        expect(positiveIntOrUndefined('')).toBeUndefined();
    });
});
