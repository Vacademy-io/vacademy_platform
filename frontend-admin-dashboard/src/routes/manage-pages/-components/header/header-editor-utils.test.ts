import { describe, expect, it } from 'vitest';
import {
    fromSitePath,
    isUsableHeaderLink,
    keepMegaMenuItems,
    navItemTypePatch,
    toSitePath,
    unknownPatternTokens,
    type HeaderNavItemValue,
} from './header-editor-utils';

describe('toSitePath / fromSitePath', () => {
    it('stores a picked page as a site path and shows it back as the page', () => {
        expect(toSitePath('find-your-path')).toBe('/find-your-path');
        expect(toSitePath('homepage')).toBe('/');
        expect(toSitePath('/courses?stream=shiksha')).toBe('/courses?stream=shiksha');
        expect(fromSitePath('/find-your-path')).toBe('find-your-path');
        expect(fromSitePath('/')).toBe('homepage');
    });

    it('leaves URLs, queries and empty values alone', () => {
        expect(toSitePath('https://example.com/x')).toBe('https://example.com/x');
        expect(toSitePath('  ')).toBe('');
        expect(fromSitePath('/courses?stream=kala')).toBe('/courses?stream=kala');
        expect(fromSitePath('https://example.com')).toBe('https://example.com');
        expect(fromSitePath(undefined)).toBe('');
    });
});

describe('isUsableHeaderLink', () => {
    it('accepts what the live header follows', () => {
        for (const ok of ['', '/', '/courses?stream={stream}', 'https://example.com/a']) {
            expect(isUsableHeaderLink(ok)).toBe(true);
        }
    });

    it('flags what the live header would drop', () => {
        for (const bad of [
            'courses',
            '//evil.example',
            '/\\evil.example',
            'mailto:a@b.c',
            'javascript:x',
            'https://',
        ]) {
            expect(isUsableHeaderLink(bad)).toBe(false);
        }
    });
});

describe('unknownPatternTokens', () => {
    it('lists placeholders the pattern cannot fill', () => {
        expect(
            unknownPatternTokens('/courses?stream={stream}&c={category}', ['stream', 'category'])
        ).toEqual([]);
        expect(unknownPatternTokens('/s/{strem}/{stream}/{x}{x}', ['stream'])).toEqual([
            'strem',
            'x',
        ]);
        expect(unknownPatternTokens(undefined, ['stream'])).toEqual([]);
    });
});

describe('keepMegaMenuItems', () => {
    const page = (label: string): HeaderNavItemValue => ({ label, route: label.toLowerCase() });
    const mega = (label: string): HeaderNavItemValue => ({
        label,
        route: '',
        type: 'megaMenu',
        megaMenu: { libraryId: 'lib' },
    });

    it('keeps each mega-menu item at its old position in the synced list', () => {
        const streams = mega('Knowledge Streams');
        const synced = keepMegaMenuItems(
            [streams, page('Old'), page('About')],
            [page('Home'), page('Courses'), page('About')]
        );
        expect(synced.map((i) => i.label)).toEqual([
            'Knowledge Streams',
            'Home',
            'Courses',
            'About',
        ]);
        // The very same object: label, route and the whole menu config survive.
        expect(synced[0]).toBe(streams);
    });

    it('keeps several in their order, clamping positions past the end', () => {
        const a = mega('A');
        const b = mega('B');
        expect(
            keepMegaMenuItems([page('X'), a, page('Y'), page('Z'), b], [page('Home')]).map(
                (i) => i.label
            )
        ).toEqual(['Home', 'A', 'B']);
    });

    it('is the plain page list when there is no mega-menu item', () => {
        const fromPages = [page('Home'), page('About')];
        expect(
            keepMegaMenuItems([page('Old'), { ...page('Typed'), type: 'link' }], fromPages)
        ).toEqual(fromPages);
        expect(keepMegaMenuItems(undefined, fromPages)).toEqual(fromPages);
    });
});

describe('navItemTypePatch', () => {
    it('starts a mega menu with the legend on, and keeps an earlier config', () => {
        expect(navItemTypePatch({ label: 'Streams', route: '' }, 'megaMenu')).toEqual({
            type: 'megaMenu',
            megaMenu: { showLegend: true },
        });
        const kept = { libraryId: 'lib', eyebrow: 'Six streams' };
        expect(
            navItemTypePatch({ label: 'Streams', route: '', megaMenu: kept }, 'megaMenu')
        ).toEqual({
            type: 'megaMenu',
            megaMenu: kept,
        });
        expect(navItemTypePatch({ label: 'Streams', route: '', megaMenu: kept }, 'link')).toEqual({
            type: 'link',
        });
    });
});
