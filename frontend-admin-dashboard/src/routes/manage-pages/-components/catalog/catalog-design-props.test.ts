import { describe, expect, it } from 'vitest';
import {
    chipActionOf,
    movedGroupOrder,
    optionIdFrom,
    parseTagList,
    setOrDelete,
    sidebarGroupRows,
    streamOptionsFromItems,
    streamOptionsFromTree,
    toggleSlug,
    uniqueId,
    withChipAction,
} from './catalog-design-props';
import type { FolderNode } from '../../-services/folder-library-service';

const folder = (
    id: string,
    extra: Partial<FolderNode>,
    children: FolderNode[] = []
): FolderNode => ({
    id,
    node_type: 'FOLDER',
    display_order: 0,
    status: 'ACTIVE',
    children,
    ...extra,
});

describe('streamOptionsFromTree', () => {
    it('keys streams and categories the way the site links them', () => {
        const roots = [
            folder('s1', { title: 'शिक्षा', subtitle: 'Education', slug: 'shiksha' }, [
                folder('c1', { title: 'गुरुकुल', subtitle: 'Gurukul Education' }),
            ]),
            { ...folder('p1', { title: 'A page' }), node_type: 'PRODUCT_PAGE' as const },
        ];
        expect(streamOptionsFromTree(roots)).toEqual([
            {
                slug: 'shiksha',
                label: 'शिक्षा · Education',
                categories: [{ slug: 'gurukul-education', label: 'गुरुकुल · Gurukul Education' }],
            },
        ]);
        expect(streamOptionsFromTree(null)).toEqual([]);
    });

    it('reads tag tabs, skipping the ones without a key', () => {
        expect(
            streamOptionsFromItems([{ label: 'Kala', slug: 'kala' }, { label: 'No key' }, 'junk'])
        ).toEqual([{ slug: 'kala', label: 'Kala', categories: [] }]);
    });
});

describe('Popular chip actions', () => {
    it('follows the site precedence, then the action just picked', () => {
        expect(chipActionOf({ label: 'x', streamSlug: 'a', quickFilterId: 'q' })).toBe('stream');
        expect(chipActionOf({ label: 'x', searchValue: 'gita', streamSlug: 'a' })).toBe('search');
        expect(chipActionOf({ label: 'x', quickFilterId: 'qf-free' })).toBe('quickFilter');
        expect(chipActionOf({ label: 'x', route: '' })).toBe('link');
        expect(chipActionOf({ label: 'x' })).toBe('stream');
    });

    it('switching drops the old action keys and keeps the rest', () => {
        expect(
            withChipAction(
                { label: 'Garbha', streamSlug: 'swasthya', categorySlug: 'g', note: 1 },
                'link'
            )
        ).toEqual({ label: 'Garbha', note: 1, route: '' });
    });
});

describe('small writers', () => {
    it('setOrDelete removes an emptied override', () => {
        expect(setOrDelete({ paid: 'Enrol', read: 'Read' }, 'paid', '')).toEqual({ read: 'Read' });
        expect(setOrDelete(undefined, 'paid', 'Enrol')).toEqual({ paid: 'Enrol' });
    });

    it('toggleSlug keeps the order of the others', () => {
        expect(toggleSlug(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
        expect(toggleSlug(['a'], 'z')).toEqual(['a', 'z']);
    });

    it('builds URL keys and tag lists', () => {
        expect(optionIdFrom("Women's health")).toBe('women-s-health');
        expect(uniqueId('parents', ['Parents', 'parents-2'])).toBe('parents-3');
        expect(parseTagList(' For-Parents, ,parents,for-parents ')).toEqual([
            'for-parents',
            'parents',
        ]);
    });
});

describe('sidebar group order', () => {
    const props = {
        priceFilter: { enabled: true, label: 'Price' },
        languageFilter: { enabled: false },
        customFilters: [
            { id: 'format', label: 'Format', source: 'courseFormats' },
            { id: 'for', label: 'For', enabled: false },
        ],
        filterSidebar: { order: ['price', 'Format', 'level'] },
    };

    it('lists the groups like the site: authored order first, then the original order', () => {
        expect(sidebarGroupRows(props).map((r) => [r.id, r.shown])).toEqual([
            ['price', true],
            ['format', true],
            ['language', false],
            ['for', false],
        ]);
    });

    it('a move writes every shown group and keeps ids the editor does not list', () => {
        const rows = sidebarGroupRows(props);
        expect(movedGroupOrder(rows, 3, -1, props.filterSidebar.order)).toEqual([
            'price',
            'format',
            'for',
            'language',
            'level',
        ]);
        expect(movedGroupOrder(rows, 0, -1, props.filterSidebar.order)).toEqual(
            props.filterSidebar.order
        );
    });
});
