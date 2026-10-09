import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogDiscoveryEditor } from './CatalogDiscoveryEditor';

/**
 * The editor writes nested objects (streams, badges, priceFilter…) through the
 * section's single updateComponent, always as a full props object. These
 * check the shapes it writes, which the learner renderer then validates.
 */

vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('../../-services/folder-library-service', () => ({
    folderLibrariesQueryKey: (id: string) => ['FOLDER_LIBRARIES', id],
    listFolderLibraries: vi.fn(async () => [
        { id: 'lib-1', institute_id: 'inst-1', name: 'Knowledge streams', node_count: 12 },
    ]),
}));
const storeState = { config: { globalSettings: {} as Record<string, unknown> } };
vi.mock('../../-stores/editor-store', () => ({ useEditorStore: () => storeState }));

const setup = (props: Record<string, unknown> = {}) => {
    const updateComponent = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <CatalogDiscoveryEditor
                component={{
                    id: 'cc-1',
                    type: 'courseCatalog',
                    props: { title: 'Courses', ...props },
                }}
                pageId="page-1"
                updateComponent={updateComponent}
            />
        </QueryClientProvider>
    );
    const lastProps = () =>
        (updateComponent.mock.calls.at(-1)?.[2] as { props: Record<string, unknown> }).props;
    return { updateComponent, lastProps };
};

describe('CatalogDiscoveryEditor', () => {
    it('switches stream tabs on with folder-library defaults, keeping other props', () => {
        const { updateComponent, lastProps } = setup();
        fireEvent.click(screen.getByRole('switch', { name: 'Stream tabs' }));
        expect(updateComponent).toHaveBeenCalledWith('page-1', 'cc-1', expect.any(Object));
        expect(lastProps()).toEqual({
            title: 'Courses',
            streams: { source: 'folderLibrary', sticky: true, labelMode: 'title', enabled: true },
        });
    });

    it('picks the folder library for the tabs', async () => {
        const { lastProps } = setup({ streams: { enabled: true, source: 'folderLibrary' } });
        const select = screen.getByLabelText('Folder library');
        await screen.findByRole('option', { name: 'Knowledge streams' });
        fireEvent.change(select, { target: { value: 'lib-1' } });
        expect(lastProps().streams).toEqual({
            enabled: true,
            source: 'folderLibrary',
            libraryId: 'lib-1',
        });
    });

    it('adds tag tabs and keeps the URL key in step with the tag', () => {
        const { lastProps } = setup({ streams: { enabled: true, source: 'tags', items: [] } });
        fireEvent.click(screen.getByRole('button', { name: /Add tab/ }));
        expect(lastProps().streams).toEqual({
            enabled: true,
            source: 'tags',
            items: [{ label: '', slug: '', tag: '' }],
        });
    });

    it('derives a tab URL key from its tag until the key is edited', () => {
        const { lastProps } = setup({
            streams: {
                enabled: true,
                source: 'tags',
                items: [{ label: 'Shiksha', slug: '', tag: '' }],
            },
        });
        fireEvent.change(screen.getByLabelText('Tab 1 course tag'), {
            target: { value: 'Shiksha Courses' },
        });
        expect(lastProps().streams).toMatchObject({
            items: [{ label: 'Shiksha', slug: 'shiksha-courses', tag: 'Shiksha Courses' }],
        });
    });

    it('adds a quick filter with a unique id and the next unused kind', () => {
        const { lastProps } = setup({ quickFilters: [{ id: 'qf-1', label: '', kind: 'popular' }] });
        fireEvent.click(screen.getByRole('button', { name: /Add quick filter/ }));
        expect(lastProps().quickFilters).toEqual([
            { id: 'qf-1', label: '', kind: 'popular' },
            { id: 'qf-2', label: '', kind: 'new' },
        ]);
    });

    it('stores price amounts as numbers', () => {
        const { lastProps } = setup({ priceFilter: { enabled: true } });
        const input = screen.getByLabelText('“Under” amounts');
        fireEvent.change(input, { target: { value: '1000, 500, nope' } });
        fireEvent.blur(input);
        expect(lastProps().priceFilter).toEqual({ enabled: true, maxOptions: [500, 1000] });
    });

    it('turns badges on with the learner defaults', () => {
        const { lastProps } = setup();
        fireEvent.click(screen.getByRole('switch', { name: 'Badges on cards' }));
        expect(lastProps().badges).toEqual({
            types: ['bestseller', 'popular', 'new', 'free'],
            newDays: 60,
            bestsellerTop: 3,
            max: 2,
            enabled: true,
        });
    });

    it('warns that language features wait for Course languages in Site settings', () => {
        storeState.config.globalSettings = {};
        setup({ languageFilter: { enabled: true } });
        expect(screen.getByText(/Turn on Course languages in Site settings/)).toBeInTheDocument();
    });

    it('does not warn once Course languages are on', () => {
        storeState.config.globalSettings = { courseLanguages: { enabled: true } };
        setup({ languageFilter: { enabled: true } });
        expect(
            screen.queryByText(/Turn on Course languages in Site settings/)
        ).not.toBeInTheDocument();
        storeState.config.globalSettings = {};
    });
});
