import { describe, expect, it, vi } from 'vitest';
import { runPublishChecks } from './publish-checks';

vi.mock('@/components/common/layout-container/sidebar/utils', () => ({
    getTerminology: (a: string) => a,
}));
vi.mock('@/routes/settings/-components/NamingSettings', () => ({
    ContentTerms: { Course: 'Course' },
    SystemTerms: { Course: 'Course' },
}));

/** A site with no problems at all: analytics set, a meta description, nothing unwired. */
const site = (components: any[] = [], globalSettings: Record<string, unknown> = {}) => ({
    globalSettings: { tracking: { gtmId: 'GTM-1' }, ...globalSettings },
    pages: [{ id: 'home', route: 'home', title: 'Home', seo: { metaDescription: 'Hello' }, components }],
});

const titles = (config: any) => runPublishChecks(config).map((i) => i.title);

describe('publish checks — Knowledge Streams additions', () => {
    it('adds nothing for a site that uses none of the new features', () => {
        expect(runPublishChecks(site([{ id: 'h', type: 'heroSection', enabled: true, props: { title: 'Hi' } }]))).toEqual([]);
    });

    it('flags a site cart switched on without a store page', () => {
        const issues = runPublishChecks(site([], { siteCart: { enabled: true, storeProductPageCode: ' ' } }));
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ severity: 'error', title: 'The site cart is on but has no store page' });
        expect(titles(site([], { siteCart: { enabled: true, storeProductPageCode: 'store' } }))).toEqual([]);
        expect(titles(site([], { siteCart: { enabled: false } }))).toEqual([]);
    });

    it('flags a learning path with nothing to show', () => {
        const single = { id: 'lp1', type: 'learningPath', enabled: true, props: { mode: 'single', productPageCode: '' } };
        const list = { id: 'lp2', type: 'learningPath', enabled: true, props: { mode: 'list', libraryId: '' } };
        const issues = runPublishChecks(site([single, list]));
        expect(issues.map((i) => [i.severity, i.componentId])).toEqual([
            ['error', 'lp1'],
            ['error', 'lp2'],
        ]);
        expect(issues[0]!.title).toMatch(/no product page/);
        expect(issues[1]!.title).toMatch(/no folder library/);
        // Legacy/absent mode means single.
        expect(titles(site([{ id: 'x', type: 'learningPath', props: {} }]))).toEqual([
            'A Learning Path section has no product page selected',
        ]);
        expect(
            titles(
                site([
                    { ...single, props: { productPageCode: 'pp' } },
                    { ...list, props: { mode: 'list', libraryId: 'lib' } },
                ])
            )
        ).toEqual([]);
    });

    it('warns about a visibility rule without a parameter, including inside columns', () => {
        const ok = { id: 'a', type: 'textBlock', props: {}, visibleWhen: [{ param: 'stream', op: 'empty' }] };
        const bad = { id: 'b', type: 'textBlock', props: {}, visibleWhen: [{ param: '', op: 'empty' }] };
        const columns = { id: 'cols', type: 'columnLayout', props: { slots: [[bad]] } };
        const issues = runPublishChecks(site([ok, columns]));
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ severity: 'warning', componentId: 'b' });
    });
});
