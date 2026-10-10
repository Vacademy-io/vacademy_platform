import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LearningPathEditor } from './LearningPathEditor';
import { featuredPathSiblings, syncSharedPathProps } from './learning-path-shared';
import { useEditorStore } from '../../-stores/editor-store';
import type { CatalogueConfig, Component, LearningPathProps } from '../../-types/editor-types';
import brahmVarchasSite from '../brahm-varchas-site.fixture.json';

/**
 * The featured list layout (Brahm Varchas Learning Paths page): goal chips,
 * featured path, badge and "More learning paths" are editable, and the two
 * sections that split the layout ('paths' above the band, 'paths-more'
 * below it) keep the same goals and featured path.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));

const LIBRARY = '904e2152-f6b8-4c49-bfa0-e8849d13825f';
const folder = (id: string, slug: string, title: string, children: unknown[] = []) => ({
    id,
    node_type: 'FOLDER',
    title,
    slug,
    status: 'ACTIVE',
    display_order: 0,
    children,
});
const path = (id: string, code: string, title: string) => ({
    id,
    node_type: 'PRODUCT_PAGE',
    title,
    product_page_code: code,
    status: 'ACTIVE',
    display_order: 0,
    children: [],
});
const queryData: Record<string, unknown> = {
    PRODUCT_PAGES_FOR_CATALOGUE: [
        { id: 'pp-1', code: 'forbvy', name: "A woman's life stages", status: 'ACTIVE' },
        { id: 'pp-2', code: '92ogt2', name: 'India of temples', status: 'ACTIVE' },
        { id: 'pp-3', code: 'u5rgwb', name: 'First steps in Scriptures', status: 'ACTIVE' },
        { id: 'pp-9', code: 'other', name: 'Not a path', status: 'ACTIVE' },
    ],
    FOLDER_LIBRARIES: [{ id: LIBRARY, name: 'Knowledge Streams', node_count: 8 }],
    FOLDER_LIBRARY_TREE: {
        library: { id: LIBRARY, name: 'Knowledge Streams' },
        roots: [
            folder('s1', 'swasthya', 'Health', [path('p1', 'forbvy', "A woman's life stages")]),
            folder('s2', 'dharma', 'Virtue'),
            folder('s3', 'bharat', 'Bharat', [path('p2', '92ogt2', 'India of temples')]),
            folder('s4', 'shastra', 'Scriptures', [path('p3', 'u5rgwb', 'First steps in Scriptures')]),
            folder('s5', 'shiksha', 'Education'),
        ],
    },
};
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQuery: ({ queryKey, enabled }: { queryKey: unknown[]; enabled?: boolean }) => ({
        data: enabled === false ? undefined : queryData[String(queryKey[0])],
        isLoading: false,
        isError: false,
    }),
}));

const fixture = () => JSON.parse(JSON.stringify(brahmVarchasSite)) as CatalogueConfig;
const sectionOf = (id: string, config = useEditorStore.getState().config!) =>
    config.pages.find((p) => p.id === 'learning-paths')!.components.find((c) => c.id === id)!;
const propsOf = (id: string) => sectionOf(id).props as LearningPathProps;

/** The editor as the panel mounts it: on the store's section, writing through the store. */
const Panel = ({ id }: { id: string }) => {
    const component = useEditorStore((s) => sectionOf(id, s.config!));
    const updateComponent = useEditorStore((s) => s.updateComponent);
    return <LearningPathEditor component={component} pageId="learning-paths" updateComponent={updateComponent} />;
};
const renderSection = (id: string) => render(<Panel id={id} />);

const without = (props: object, ...keys: string[]) =>
    Object.fromEntries(Object.entries(props).filter(([k]) => !keys.includes(k)));

beforeEach(() => {
    useEditorStore.getState().setConfig(fixture());
    useEditorStore.getState().setEditingLocale(null);
});

describe('LearningPathEditor featured layout (Brahm Varchas)', () => {
    it('changing the featured path updates both sections in one undoable edit, keeping every other prop', () => {
        const before = fixture();
        renderSection('paths');
        const picker = screen.getByRole('combobox', { name: 'featured.path' });
        // Only the library's product pages are offered.
        expect(within(picker).queryByRole('option', { name: 'Not a path' })).not.toBeInTheDocument();
        const historyIndex = useEditorStore.getState().historyIndex;

        fireEvent.change(picker, { target: { value: 'u5rgwb' } });

        for (const id of ['paths', 'paths-more']) {
            const old = sectionOf(id, before).props as LearningPathProps;
            expect(propsOf(id).featured).toEqual({ code: 'u5rgwb', badge: 'Most popular path' });
            expect(without(propsOf(id), 'featured')).toEqual(without(old, 'featured'));
        }
        expect(useEditorStore.getState().historyIndex).toBe(historyIndex + 1);

        useEditorStore.getState().undo();
        expect(propsOf('paths').featured).toEqual({ code: 'forbvy', badge: 'Most popular path' });
        expect(propsOf('paths-more').featured).toEqual({ code: 'forbvy', badge: 'Most popular path' });
    });

    it('edits the badge, goal chips and their streams on both sections', () => {
        renderSection('paths-more');
        fireEvent.change(screen.getByRole('textbox', { name: 'featured.badge' }), { target: { value: 'Start here' } });
        fireEvent.change(screen.getAllByRole('textbox', { name: 'goals.label' })[0]!, {
            target: { value: 'Raise my children' },
        });
        // Goal 1 (dharma) also matches the Bharat stream.
        const firstGoal = screen.getAllByRole('group', { name: 'goals.streams' })[0]!;
        expect(within(firstGoal).getByRole('button', { name: 'Virtue' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(within(firstGoal).getByRole('button', { name: 'Bharat' }));
        fireEvent.click(screen.getByRole('button', { name: 'goals.add' }));

        for (const id of ['paths', 'paths-more']) {
            const goals = propsOf(id).goals!;
            expect(propsOf(id).featured).toEqual({ code: 'forbvy', badge: 'Start here' });
            expect(goals[0]).toEqual({ key: 'child', label: 'Raise my children', tags: ['dharma', 'bharat'] });
            expect(goals).toHaveLength(6);
            expect(goals[5]).toEqual({ key: 'goal-6', label: '', tags: [] });
            expect(propsOf(id).pathExtras).toEqual(fixture().pages[1]!.components[1]!.props.pathExtras);
        }
        // Each section keeps its own parts.
        expect(propsOf('paths-more')).toMatchObject({ showGoals: false, showFeatured: false });
        expect(propsOf('paths').showGrid).toBe(false);
    });

    it('part toggles and the grid heading stay on the section edited', () => {
        renderSection('paths-more');
        fireEvent.change(screen.getByRole('textbox', { name: 'more.title' }), { target: { value: 'Other paths' } });
        fireEvent.click(screen.getByRole('switch', { name: 'featured.showGoals' }));
        expect(propsOf('paths-more')).toMatchObject({ moreTitle: 'Other paths', showGoals: true });
        expect(propsOf('paths').moreTitle).toBe('More learning paths');
        expect(propsOf('paths').showGoals).toBeUndefined();
    });

    it('hides the goal heading where goals are off, and the subtitle in this layout', () => {
        const more = renderSection('paths-more');
        expect(screen.queryByRole('textbox', { name: 'heading.goalsTitle' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Subtitle' })).not.toBeInTheDocument();
        expect(screen.getByText('featured.syncNote')).toBeInTheDocument();
        more.unmount();
        renderSection('paths');
        expect(screen.getByRole('textbox', { name: 'heading.goalsTitle' })).toHaveValue('What do you want to achieve?');
        // Grid off on this section: no grid heading fields.
        expect(screen.queryByRole('textbox', { name: 'more.title' })).not.toBeInTheDocument();
    });

    it('in another language, a base change (featured path) still reaches the copy', () => {
        useEditorStore.getState().setEditingLocale('hi');
        renderSection('paths');
        fireEvent.change(screen.getByRole('combobox', { name: 'featured.path' }), { target: { value: '92ogt2' } });
        expect(propsOf('paths').featured?.code).toBe('92ogt2');
        expect(propsOf('paths-more').featured?.code).toBe('92ogt2');
    });

    it('a section reading the other through sharedWith shows a note instead of a copy to edit', () => {
        const config = fixture();
        const more = config.pages[1]!.components.find((c) => c.id === 'paths-more')!;
        more.props = { ...without(more.props, 'goals', 'featured'), sharedWith: 'paths' };
        useEditorStore.getState().setConfig(config);
        renderSection('paths-more');
        expect(screen.getByText('featured.sharedFrom')).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'featured.path' })).not.toBeInTheDocument();
    });
});

describe('LearningPathEditor without the featured layout', () => {
    it('shows no featured fields on a plain list and keeps Title and Subtitle', () => {
        render(
            <LearningPathEditor
                component={{ id: 'lp', props: { mode: 'list', libraryId: LIBRARY, title: 'Paths' } }}
                pageId="home"
                updateComponent={vi.fn()}
            />
        );
        expect(screen.queryByText('featured.title')).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Paths');
        expect(screen.getByRole('textbox', { name: 'Subtitle' })).toBeInTheDocument();
    });
});

describe('syncSharedPathProps', () => {
    const page = (components: Component[]): CatalogueConfig =>
        ({ ...fixture(), pages: [{ id: 'p', route: 'p', components }] }) as CatalogueConfig;
    const lp = (id: string, props: LearningPathProps): Component => ({ id, type: 'learningPath', enabled: true, props });
    const base: LearningPathProps = { mode: 'list', listLayout: 'featured', libraryId: 'lib' };

    it('pairs the two Brahm Varchas sections', () => {
        const components = fixture().pages[1]!.components;
        const paths = components.find((c) => c.id === 'paths')!;
        expect(featuredPathSiblings(components, paths).map((c) => c.id)).toEqual(['paths-more']);
    });

    it('copies only to featured lists of the same library that keep their own copy', () => {
        const config = page([
            lp('a', { ...base, featured: { code: 'x' } }),
            lp('b', { ...base, featured: { code: 'y' }, moreTitle: 'Keep' }),
            lp('c', { ...base, libraryId: 'other', featured: { code: 'y' } }),
            lp('d', { ...base, sharedWith: 'a' }),
            lp('e', { mode: 'list', libraryId: 'lib', featured: { code: 'y' } }),
        ]);
        const next = syncSharedPathProps(config, 'p', 'a', ['featured', 'moreTitle']);
        const [a, b, c, d, e] = next.pages[0]!.components;
        expect(b!.props).toEqual({ ...base, featured: { code: 'x' }, moreTitle: 'Keep' });
        expect(c).toBe(config.pages[0]!.components[2]);
        expect(d).toBe(config.pages[0]!.components[3]);
        expect(e).toBe(config.pages[0]!.components[4]);
        expect(a).toBe(config.pages[0]!.components[0]);
    });

    it('returns the same config when the copies already match', () => {
        const config = page([lp('a', { ...base, goals: [] }), lp('b', { ...base, goals: [] })]);
        expect(syncSharedPathProps(config, 'p', 'a', ['goals'])).toBe(config);
    });
});
