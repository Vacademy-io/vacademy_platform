import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DndContext, useDndContext } from '@dnd-kit/core';
import { CanvasRenderer } from './CanvasRenderer';
import { renderComponentPreview } from './ComponentPreviews';
import { useEditorStore } from '../-stores/editor-store';
import type { CatalogueConfig, Component } from '../-types/editor-types';
import { catalogFeatures, firstHeading, moveItem } from '../-utils/block-summary';
import brahmVarchas from './__fixtures__/brahm-varchas-site.json';

/**
 * The canvas's "Structure" view against the real Brahm Varchas site: every
 * block is one row (hidden ones included), rows reorder, and the look-alike
 * previews other screens still use no longer draw this site's header
 * white-on-white or its catalogue as an anonymous grey box.
 *
 * Strings come from the real English locale files, so a missing key fails.
 */

vi.mock('react-i18next', async () => {
    const resources: Record<string, unknown> = {
        managePagesPageCanvas: (
            await import('../../../../public/locales/en/managePagesPageCanvas.json')
        ).default,
        managePagesComponentPreviews: (
            await import('../../../../public/locales/en/managePagesComponentPreviews.json')
        ).default,
    };
    const lookup = (ns: string, key: string): string | undefined => {
        const value = key
            .split('.')
            .reduce<unknown>(
                (node, part) => (node as Record<string, unknown>)?.[part],
                resources[ns]
            );
        return typeof value === 'string' ? value : undefined;
    };
    const makeT = (ns: string) => (key: string, opts?: Record<string, unknown>) => {
        const count = opts?.count;
        const raw =
            (typeof count === 'number'
                ? lookup(ns, `${key}_${count === 1 ? 'one' : 'other'}`)
                : undefined) ??
            lookup(ns, key) ??
            `MISSING:${ns}:${key}`;
        return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ''));
    };
    return { useTranslation: (ns: string) => ({ t: makeT(ns) }) };
});
vi.mock('@/stores/students/students-list/useInstituteDetailsStore', () => ({
    useInstituteDetailsStore: () => ({
        instituteDetails: { learner_portal_base_url: 'learn.example.org' },
        setInstituteDetails: vi.fn(),
    }),
}));
vi.mock('@/services/student-list-section/getInstituteDetails', () => ({
    fetchBothInstituteAPIs: () => Promise.resolve(null),
}));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));

const VIEW_KEY = 'catalogue-editor-canvas-view';

// Node's own (flag-gated) localStorage shadows the DOM one here; use a plain map.
const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, String(value)),
    removeItem: (key: string) => void stored.delete(key),
    clear: () => stored.clear(),
});

/** A fresh copy of the live site, so no test sees another's edits. */
const site = (): CatalogueConfig => JSON.parse(JSON.stringify(brahmVarchas)) as CatalogueConfig;

const loadSite = (config: CatalogueConfig, pageId: string) => {
    useEditorStore.getState().setConfig(config);
    useEditorStore.getState().selectPage(pageId);
};

const pageBlocks = (pageId: string): Component[] =>
    useEditorStore.getState().config!.pages.find((p) => p.id === pageId)!.components;

/** Ids of every droppable the canvas registered with the editor's DndContext. */
let droppableIds: string[] = [];
const DroppableProbe = () => {
    const { droppableContainers } = useDndContext();
    droppableIds = Array.from(droppableContainers.keys()).map(String);
    return null;
};

const renderCanvas = () =>
    render(
        <DndContext>
            <CanvasRenderer tagName="brahmvarchas" />
            <DroppableProbe />
        </DndContext>
    );

const rows = () => screen.getAllByRole('listitem');

beforeEach(() => {
    localStorage.setItem(VIEW_KEY, 'editor');
    useEditorStore.getState().setEditingLocale(null);
});

describe('Structure view (Brahm Varchas)', () => {
    it('opens on the stored choice and names the view "Structure"', () => {
        loadSite(site(), 'courses');
        renderCanvas();
        expect(screen.getByRole('button', { name: /Structure/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Editor$/ })).not.toBeInTheDocument();
        expect(screen.queryByTitle('Tablet (768px)')).not.toBeInTheDocument();
        expect(document.querySelector('iframe')).toBeNull();

        // The choice is stored under its old value, so earlier choices still apply.
        stored.clear();
        fireEvent.click(screen.getByRole('button', { name: /Structure/ }));
        expect(localStorage.getItem(VIEW_KEY)).toBe('editor');
    });

    it('lists every block with its label, first heading and a Hidden badge', () => {
        const config = site();
        const lp = config.pages.find((p) => p.id === 'learning-paths')!;
        lp.components.find((c) => c.id === 'lp-app')!.enabled = false;
        loadSite(config, 'learning-paths');
        renderCanvas();

        const listed = rows();
        expect(listed.map((row) => row.getAttribute('data-block-id'))).toEqual(
            lp.components.map((c) => c.id)
        );
        expect(within(listed[0]!).getByText('Hero Section')).toBeInTheDocument();
        expect(within(listed[0]!).getByText('Not sure where to start?')).toBeInTheDocument();
        expect(within(listed[1]!).getByText('What do you want to achieve?')).toBeInTheDocument();
        expect(within(listed[5]!).getByText('How a learning path works')).toBeInTheDocument();

        const hidden = listed.find((row) => row.getAttribute('data-block-id') === 'lp-app')!;
        expect(within(hidden).getByText('Hidden')).toBeInTheDocument();
        expect(
            within(hidden).getByText('Walk your path, one step at a time, from your phone.')
        ).toBeInTheDocument();
        expect(screen.getAllByText('Hidden')).toHaveLength(1);

        // Site chrome: the header (no heading) by its menu, the footer by its brand.
        expect(screen.getByText('Site header')).toBeInTheDocument();
        expect(
            screen.getByText(/^Knowledge Streams · Courses · Learning Paths/)
        ).toBeInTheDocument();
        expect(screen.getByText('Site footer')).toBeInTheDocument();
        expect(screen.getByText('Brahm Varchas')).toBeInTheDocument();
    });

    it('summarises the course catalogue by the features it uses', () => {
        loadSite(site(), 'courses');
        renderCanvas();
        const catalog = rows()[0]!;
        expect(within(catalog).getByText('Course Catalog')).toBeInTheDocument();
        expect(within(catalog).getByText('All courses')).toBeInTheDocument();
        expect(
            within(catalog).getByText(
                'Hero · Stream icons · Filter sidebar · 3 highlighted rows · Editorial cards'
            )
        ).toBeInTheDocument();
    });

    it('clicking a row selects that block; the header row selects the site header', () => {
        loadSite(site(), 'courses');
        renderCanvas();
        fireEvent.click(within(rows()[1]!).getByText('CTA Banner'));
        expect(useEditorStore.getState().selectedComponentId).toBe('courses-not-sure');
        fireEvent.click(screen.getByText('Site header'));
        expect(useEditorStore.getState().selectedGlobalLayout).toBe('header');
    });

    it('dragging a row by its handle moves the block and keeps every prop', () => {
        loadSite(site(), 'learning-paths');
        const before = pageBlocks('learning-paths');
        renderCanvas();

        const [first, , third] = rows();
        fireEvent.dragStart(first!, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
        fireEvent.dragOver(third!, { dataTransfer: { dropEffect: '' } });
        fireEvent.drop(third!, { dataTransfer: {} });

        const after = pageBlocks('learning-paths');
        expect(after.map((c) => c.id)).toEqual(moveItem(before, 0, 2)!.map((c) => c.id));
        expect(after[2]).toEqual(before[0]);
        expect(rows().map((row) => row.getAttribute('data-block-id'))).toEqual(
            after.map((c) => c.id)
        );

        // One undo step brings the old order back.
        act(() => useEditorStore.getState().undo());
        expect(pageBlocks('learning-paths').map((c) => c.id)).toEqual(before.map((c) => c.id));
    });

    it('the handle moves a block with the arrow keys', () => {
        loadSite(site(), 'courses');
        renderCanvas();
        const handle = within(rows()[1]!).getByRole('button', { name: /Move CTA Banner/ });
        fireEvent.keyDown(handle, { key: 'ArrowUp' });
        expect(pageBlocks('courses').map((c) => c.id)).toEqual([
            'courses-not-sure',
            'courses-catalog',
        ]);
        // Already first: nothing moves, nothing is recorded.
        const historyLength = useEditorStore.getState().history.length;
        fireEvent.keyDown(within(rows()[0]!).getByRole('button', { name: /Move CTA Banner/ }), {
            key: 'ArrowUp',
        });
        expect(useEditorStore.getState().history.length).toBe(historyLength);
    });

    it('editing in Hindi shows Hindi headings but reorders the English blocks untouched', () => {
        loadSite(site(), 'courses');
        useEditorStore.getState().setEditingLocale('hi');
        renderCanvas();
        expect(within(rows()[0]!).getByText('सभी पाठ्यक्रम')).toBeInTheDocument();

        fireEvent.keyDown(within(rows()[1]!).getByRole('button', { name: /Move CTA Banner/ }), {
            key: 'ArrowUp',
        });
        const [cta] = pageBlocks('courses');
        expect(cta!.id).toBe('courses-not-sure');
        expect(cta!.props.heading).toBe('Not sure which course is right for you?');
    });

    it('keeps library drops: the page and every column are drop targets', () => {
        const config = site();
        config.pages
            .find((p) => p.id === 'courses')!
            .components.push({
                id: 'cols-1',
                type: 'columnLayout',
                enabled: true,
                props: {
                    slots: [
                        [
                            {
                                id: 'txt-1',
                                type: 'textBlock',
                                enabled: true,
                                props: { content: '<p>Hello there</p>' },
                            },
                        ],
                        [],
                    ],
                },
            });
        loadSite(config, 'courses');
        renderCanvas();
        expect(droppableIds).toEqual(
            expect.arrayContaining(['canvas-drop-zone', 'slot::cols-1::0', 'slot::cols-1::1'])
        );
        expect(screen.getByText('2 columns')).toBeInTheDocument();
        expect(screen.getByText('Hello there')).toBeInTheDocument();
        expect(screen.getByText('Empty — drag a block here')).toBeInTheDocument();
    });
});

describe('look-alike previews still used by other screens', () => {
    const header = () => site().globalSettings.layout!.header as Component;
    const INK = '#1A1A1A'; // design-lint-ignore: the preview's fallback ink
    const WHITE = '#FFFFFF'; // design-lint-ignore: the preview's fallback ink
    const AUTHORED = '#883000'; // design-lint-ignore: fixture colour

    it('header text contrasts with a white bar', () => {
        render(<>{renderComponentPreview(header())}</>);
        const nav = screen.getByText('Knowledge Streams');
        expect(nav.style.color.toUpperCase()).toBe(INK);
        const login = screen.getByText('Login');
        expect(login.style.backgroundColor.toUpperCase()).toBe(INK);
        expect(login.style.color.toUpperCase()).toBe(WHITE);
    });

    it('a header with no colours keeps white text on the default bar', () => {
        render(
            <>
                {renderComponentPreview({
                    type: 'header',
                    props: { navigation: [{ label: 'Home' }] },
                })}
            </>
        );
        expect(screen.getByText('Home').style.color.toUpperCase()).toBe(WHITE);
    });

    it('an authored text colour always wins', () => {
        const props = { ...header().props, textColor: AUTHORED };
        render(<>{renderComponentPreview({ type: 'header', props })}</>);
        expect(screen.getByText('Knowledge Streams').style.color.toUpperCase()).toBe(AUTHORED);
    });

    it('the course catalogue placeholder lists the features that are on', () => {
        const catalog = site().pages.find((p) => p.id === 'courses')!.components[0]!;
        render(<>{renderComponentPreview(catalog)}</>);
        expect(
            screen.getByText(
                'Hero · Stream icons · Filter sidebar · 3 highlighted rows · Editorial cards'
            )
        ).toBeInTheDocument();
    });

    it('a plain catalogue keeps the old placeholder text', () => {
        render(
            <>
                {renderComponentPreview({
                    type: 'courseCatalog',
                    props: { title: 'Our programmes' },
                })}
            </>
        );
        expect(screen.getByText('Shows live courses — "Our programmes"')).toBeInTheDocument();
    });
});

describe('block-summary helpers', () => {
    it('firstHeading reads top-level, hero, left column and rich text', () => {
        expect(firstHeading({ props: { heading: '<b>Big</b>  idea' } })).toBe('Big idea');
        expect(
            firstHeading({ props: { title: '', hero: { enabled: true, title: 'All courses' } } })
        ).toBe('All courses');
        expect(firstHeading({ props: { title: '', hero: { title: 'Off' } } })).toBe('');
        expect(firstHeading({ props: { left: { title: 'Welcome' } } })).toBe('Welcome');
        expect(
            firstHeading({
                props: {
                    navigation: [{ label: 'A' }, { label: 'B', enabled: false }, { label: 'C' }],
                },
            })
        ).toBe('A · C');
        expect(firstHeading({ props: undefined })).toBe('');
    });

    it('catalogFeatures is empty for a catalogue with no opt-ins', () => {
        expect(catalogFeatures({ title: 'x', streams: { enabled: false } })).toEqual([]);
        expect(catalogFeatures({ streams: { enabled: true } })).toEqual([{ key: 'streamTabs' }]);
    });

    it('moveItem returns null when nothing moves', () => {
        expect(moveItem(['a', 'b'], 0, 0)).toBeNull();
        expect(moveItem(['a', 'b'], 0, 2)).toBeNull();
        expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    });
});
