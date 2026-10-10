import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LiveSiteFrame, frameScale, framePayload, pageForRoute, previewPathOf, selectableId } from './LiveSiteFrame';
import { useEditorStore } from '../-stores/editor-store';
import type { CatalogueConfig, Component, Page } from '../-types/editor-types';

/**
 * The Website view: the real site laid out at a real device width and scaled
 * to fit the canvas, the page's real route and (when editing हिन्दी) the
 * language sent with the draft, Select | Browse, and the frame's clicks —
 * nested blocks, and links to other pages — landing in the editor.
 */

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));

// The test DOM must not fetch the site the frame points at.
(window as unknown as { happyDOM?: { settings: { disableIframePageLoading: boolean } } }).happyDOM!.settings.disableIframePageLoading = true;

const heading = (id: string): Component => ({ id, type: 'sectionHeading', enabled: true, props: { title: id } });
const columns: Component = {
    id: 'cols',
    type: 'columnLayout',
    enabled: true,
    props: { slots: [[heading('in-column')], []] },
};
const tabs: Component = {
    id: 'tabs',
    type: 'tabsAccordion',
    enabled: true,
    props: { items: [{ title: 'One', slot: [heading('in-tab')] }] },
};

const site = (i18nEnabled = true): CatalogueConfig =>
    ({
        globalSettings: {
            i18n: {
                enabled: i18nEnabled,
                defaultLocale: 'en',
                locales: [
                    { code: 'en', label: 'EN' },
                    { code: 'hi', label: 'हिन्दी' },
                ],
                strings: {},
            },
        },
        pages: [
            { id: 'home', route: 'home', title: 'Home', components: [heading('hero')] },
            { id: 'courses', route: 'courses', title: 'Courses', components: [columns, tabs] },
            { id: 'learning-paths', route: 'learning-paths', title: 'Learning Paths', components: [] },
        ],
    }) as unknown as CatalogueConfig;

/** jsdom has no layout: the canvas area reports this size. */
let areaSize = { width: 1152, height: 720 };
class FakeResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
        this.callback(
            [{ contentRect: { width: areaSize.width, height: areaSize.height } } as ResizeObserverEntry],
            this as unknown as ResizeObserver
        );
    }
    disconnect() {}
    unobserve() {}
}

const SITE = 'https://learn.acme.in/acme';
const renderFrame = () => render(<LiveSiteFrame siteUrl={SITE} nameInstitute={false} dropRef={() => {}} isDropOver={false} />);
const iframe = () => screen.getByTitle('frameTitle') as HTMLIFrameElement;
const fromFrame = (data: unknown) =>
    act(() => {
        window.dispatchEvent(
            new MessageEvent('message', { data, source: iframe().contentWindow as Window, origin: 'https://learn.acme.in' })
        );
    });
/** Mount, answer READY like the site does, and collect what the frame is
 *  sent. The test DOM loads no site, so the frame's window is a stand-in. */
const readyFrame = () => {
    renderFrame();
    const sent = vi.fn();
    Object.defineProperty(iframe(), 'contentWindow', { configurable: true, value: { postMessage: sent } });
    fromFrame({ type: 'PREVIEW_READY' });
    return sent;
};
const sentOfType = (sent: ReturnType<typeof vi.fn>, type: string) =>
    sent.mock.calls.map((call) => call[0] as Record<string, unknown>).filter((m) => m.type === type);

beforeEach(() => {
    areaSize = { width: 1152, height: 720 };
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    useEditorStore.getState().setConfig(site());
    useEditorStore.getState().selectPage('courses');
    useEditorStore.getState().setViewport('desktop');
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('frame size', () => {
    it('computes the scale from the container width (Fit), never above real size', () => {
        expect(frameScale(1152, 1440, true)).toBeCloseTo(0.8);
        expect(frameScale(1600, 1440, true)).toBe(1);
        expect(frameScale(1152, 1440, false)).toBe(1);
        expect(frameScale(0, 1440, true)).toBe(1);
    });

    it('lays the desktop site out at 1440 px and scales it into the canvas', () => {
        renderFrame();
        const frame = iframe();
        expect(frame.style.width).toBe('1440px');
        expect(frame.style.transform).toBe('scale(0.8)');
        expect(frame.style.transformOrigin).toBe('top left');
        expect(frame.style.height).toBe('900px'); // 720 / 0.8: fills the canvas height
        expect((frame.parentElement as HTMLElement).style.width).toBe('1152px');
    });

    it('offers 1280 for desktop and real size (100%)', () => {
        renderFrame();
        // Both width buttons share the key (t is mocked); the second is 1280.
        fireEvent.click(screen.getAllByText('toolbar.widthPx')[1]!);
        expect(iframe().style.width).toBe('1280px');
        expect(iframe().style.transform).toBe('scale(0.9)');
        fireEvent.click(screen.getByText('toolbar.actualSize'));
        expect(iframe().style.transform).toBe('');
        expect((iframe().parentElement as HTMLElement).style.width).toBe('1280px');
        expect(screen.getByTestId('live-site-area').className).toContain('overflow-auto');
    });

    it('shows tablet and phone at their real widths, unscaled when they fit', () => {
        useEditorStore.getState().setViewport('tablet');
        const { unmount } = renderFrame();
        expect(iframe().style.width).toBe('768px');
        expect(iframe().style.transform).toBe('');
        expect(screen.queryByText('toolbar.widthPx')).toBeNull();
        unmount();
        useEditorStore.getState().setViewport('mobile');
        renderFrame();
        expect(iframe().style.width).toBe('375px');
    });
});

describe('what the frame is sent', () => {
    it('the selected page as the root page, with its real route for the header', async () => {
        const sent = readyFrame();
        const [update] = sentOfType(sent, 'CATALOGUE_CONFIG_UPDATE');
        expect(update?.previewPath).toBe('courses');
        expect((update?.payload as CatalogueConfig).pages[0]?.title).toBe('Courses');
        expect(sent.mock.calls[0]?.[1]).toBe('https://learn.acme.in');
    });

    it('editing हिन्दी before languages are live: switches them on in the preview only', () => {
        useEditorStore.getState().setConfig(site(false));
        useEditorStore.getState().selectPage('home');
        useEditorStore.getState().setEditingLocale('hi');
        const sent = readyFrame();
        const [update] = sentOfType(sent, 'CATALOGUE_CONFIG_UPDATE');
        expect((update?.payload as CatalogueConfig).globalSettings.i18n?.enabled).toBe(true);
        expect(update?.previewPath).toBe('');
        // The draft itself is untouched.
        expect(useEditorStore.getState().config!.globalSettings.i18n?.enabled).toBe(false);
    });

    it('in the base language the payload keeps the site as it is', () => {
        const config = site(false);
        expect(framePayload(config, 'home', null).globalSettings.i18n?.enabled).toBe(false);
        expect(framePayload(config, 'home', 'hi').globalSettings.i18n?.enabled).toBe(true);
    });

    it('Select | Browse posts PREVIEW_INTERACT, Select first', () => {
        const sent = readyFrame();
        expect(sentOfType(sent, 'PREVIEW_INTERACT')).toEqual([{ type: 'PREVIEW_INTERACT', on: false }]);
        fireEvent.click(screen.getByText('toolbar.browse'));
        expect(sentOfType(sent, 'PREVIEW_INTERACT').at(-1)).toEqual({ type: 'PREVIEW_INTERACT', on: true });
        fireEvent.click(screen.getByText('toolbar.select'));
        expect(sentOfType(sent, 'PREVIEW_INTERACT').at(-1)).toEqual({ type: 'PREVIEW_INTERACT', on: false });
    });
});

describe('clicks in the frame', () => {
    it('a block inside a column opens that block', () => {
        readyFrame();
        fromFrame({ type: 'COMPONENT_SELECTED', componentId: 'in-column', parentId: 'cols', pageId: 'home' });
        expect(useEditorStore.getState().selectedComponentId).toBe('in-column');
    });

    it('a block inside a tab opens its tabs block (tab slots are edited there)', () => {
        readyFrame();
        fromFrame({ type: 'COMPONENT_SELECTED', componentId: 'in-tab', parentId: 'tabs', pageId: 'home' });
        expect(useEditorStore.getState().selectedComponentId).toBe('tabs');
    });

    it('with Global Settings open, selects the shown page too', () => {
        useEditorStore.getState().selectGlobalSettings();
        readyFrame();
        fromFrame({ type: 'COMPONENT_SELECTED', componentId: 'hero', pageId: 'home' });
        expect(useEditorStore.getState().selectedPageId).toBe('home');
        expect(useEditorStore.getState().selectedComponentId).toBe('hero');
    });

    it('a link to another page (Browse) opens that page', () => {
        readyFrame();
        fromFrame({ type: 'PREVIEW_NAVIGATE', route: 'learning-paths' });
        expect(useEditorStore.getState().selectedPageId).toBe('learning-paths');
        fromFrame({ type: 'PREVIEW_NAVIGATE', route: '' });
        expect(useEditorStore.getState().selectedPageId).toBe('home');
    });

    it('ignores messages from any other window', () => {
        readyFrame();
        act(() => {
            window.dispatchEvent(
                new MessageEvent('message', { data: { type: 'PREVIEW_NAVIGATE', route: 'home' }, source: window })
            );
        });
        expect(useEditorStore.getState().selectedPageId).toBe('courses');
    });
});

describe('helpers', () => {
    const pages = site().pages as Page[];

    it('pageForRoute matches by route, home aliases and the first segment', () => {
        expect(pageForRoute(pages, '/courses/')?.id).toBe('courses');
        expect(pageForRoute(pages, 'courses/some-course')?.id).toBe('courses');
        expect(pageForRoute(pages, 'homepage')?.id).toBe('home');
        expect(pageForRoute(pages, 'nope')).toBeUndefined();
    });

    it('previewPathOf gives "" for any home route', () => {
        expect(previewPathOf({ id: 'x', route: 'homepage', components: [] })).toBe('');
        expect(previewPathOf({ id: 'x', route: '/about/', components: [] })).toBe('about');
    });

    it('selectableId keeps an unknown block as it was', () => {
        expect(selectableId([columns], 'zzz', 'yyy')).toBe('zzz');
        expect(selectableId([columns], 'cols')).toBe('cols');
    });
});
