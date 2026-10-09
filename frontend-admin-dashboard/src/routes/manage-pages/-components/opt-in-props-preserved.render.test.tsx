import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyPanel } from './PropertyPanel';
import { useEditorStore } from '../-stores/editor-store';

/**
 * The Figma-fidelity opt-ins of one site (courseCatalog hero / filterSidebar /
 * columnSections / render.cardStyle, header + footer variants, theme palette,
 * content width, course formats) are authored as JSON and have no editor
 * controls yet. An admin editing anything else on the same section, the
 * global header/footer or Global Settings must not drop them: every editor
 * path spreads the props it does not manage. Renders the real panel against
 * the real store.
 */

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
    Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));
vi.mock('@/stores/students/students-list/useInstituteDetailsStore', () => ({
    useInstituteDetailsStore: () => ({ getAllLevels: () => [], getCourseFromPackage: () => [], instituteDetails: null }),
}));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQuery: () => ({ data: [], isLoading: false, isError: false }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const CATALOG_OPT_INS = {
    contentMaxWidth: 1152,
    palette: { sand: '#f5eac9' }, // design-lint-ignore: fixture colour
    hero: { enabled: true, title: 'Courses', breadcrumb: [{ label: 'Home', route: '/' }, { label: 'Courses' }] },
    filterSidebar: { variant: 'editorial', width: 280, promo: { enabled: true, title: 'App' } },
    customFilters: [{ id: 'format', label: 'Format', options: [{ id: 'ebook', label: 'E-books', levels: ['eBook'] }] }],
    columnSections: [{ id: 'free', kind: 'free-courses', limit: 3 }],
    streams: { enabled: true, source: 'folderLibrary', libraryId: 'lib-1', variant: 'icons', showCounts: true },
};
const catalog = {
    id: 'cat-1',
    type: 'courseCatalog',
    enabled: true,
    props: {
        title: 'Courses',
        showFilters: true,
        render: {
            layout: 'grid',
            cardFields: [],
            styles: { imageFit: 'cover' },
            cardStyle: 'editorial',
            card: { formats: { ebook: { label: 'E-books' } } },
            pagination: { mode: 'loadMore', pageSize: 9 },
            gridHeading: { title: 'All courses' },
        },
        ...CATALOG_OPT_INS,
    },
};
const THEME = {
    preset: 'default',
    palette: { text: '#1a1208', canvas: '#fffdf8', applyToTokens: true }, // design-lint-ignore: fixture colours
    contentMaxWidth: 1152,
};
const COURSE_FORMATS = { ebook: { label: 'E-books', levels: ['eBook'] } };
const header = {
    id: 'header-1',
    type: 'header',
    enabled: true,
    props: {
        title: 'Brahm Varchas',
        navigation: [],
        barSize: 'compact',
        contentWidth: 'shell',
        activeStyle: 'text',
        languageSwitcherStyle: 'segmented',
        cartDisplay: 'whenNotEmpty',
    },
};
const footer = {
    id: 'footer-1',
    type: 'footer',
    enabled: true,
    props: {
        layout: 'four-column',
        variant: 'brand',
        leftSection: { title: 'Brahm Varchas', text: 'x', tagline: 'Translate Knowledge', socials: [] },
        rightSection1: { title: 'Explore', links: [{ label: 'Courses', route: 'courses' }] },
        rightSection4: { title: 'Support', links: [{ label: 'FAQ', route: 'faq' }] },
        newsletter: { heading: 'Stay connected', audienceId: 'aud-1' },
        bottomTagline: 'Made with care',
    },
};

const state = () => useEditorStore.getState().config!;

beforeEach(() => {
    useEditorStore.getState().setConfig({
        pages: [{ id: 'courses', route: 'courses', title: 'Courses', components: [catalog] }],
        globalSettings: {
            theme: THEME,
            courseFormats: COURSE_FORMATS,
            courseFormatOrder: ['ebook'],
            fonts: { enabled: true, family: 'Lato, sans-serif' },
            layout: { header, footer },
        },
    } as never);
});

describe('editing a site keeps its opt-in props', () => {
    it('courseCatalog: changing the image fit keeps hero, sidebar, sections, palette, width and the render extensions', () => {
        useEditorStore.getState().selectComponent('cat-1');
        render(<PropertyPanel />);
        fireEvent.change(screen.getByDisplayValue('bookCatalogue.imageFitCover'), { target: { value: 'contain' } });
        const props = state().pages[0]!.components[0]!.props as Record<string, any>;
        expect(props.render.styles.imageFit).toBe('contain');
        expect(props).toMatchObject(CATALOG_OPT_INS);
        expect(props.render).toMatchObject({
            cardStyle: 'editorial',
            card: { formats: { ebook: { label: 'E-books' } } },
            pagination: { mode: 'loadMore', pageSize: 9 },
            gridHeading: { title: 'All courses' },
        });
    });

    it('Global Settings: changing the primary colour or the font keeps palette, content width and course formats', () => {
        useEditorStore.getState().selectGlobalSettings();
        const { container } = render(<PropertyPanel />);
        fireEvent.change(container.querySelector('input[type="color"]')!, { target: { value: '#883000' } }); // design-lint-ignore: fixture colour
        fireEvent.change(screen.getByDisplayValue('Lato'), { target: { value: '"Open Sans", sans-serif' } });
        const gs = state().globalSettings as Record<string, any>;
        expect(gs.theme).toEqual({ ...THEME, primaryColor: '#883000' }); // design-lint-ignore: fixture colour
        expect(gs.fonts.family).toBe('"Open Sans", sans-serif');
        expect(gs.courseFormats).toEqual(COURSE_FORMATS);
        expect(gs.courseFormatOrder).toEqual(['ebook']);
    });

    it('global header: renaming keeps the compact / shell / text / segmented / cart options', () => {
        useEditorStore.getState().selectGlobalLayout('header');
        render(<PropertyPanel />);
        fireEvent.change(screen.getByDisplayValue('Brahm Varchas'), { target: { value: 'BV' } });
        const props = (state().globalSettings as Record<string, any>).layout.header.props;
        expect(props).toEqual({ ...header.props, title: 'BV' });
    });

    it('global footer: renaming a link keeps the brand variant, newsletter, fourth column and tagline', () => {
        useEditorStore.getState().selectGlobalLayout('footer');
        render(<PropertyPanel />);
        fireEvent.click(screen.getByRole('button', { name: /^Courses$/ }));
        fireEvent.change(screen.getByDisplayValue('Courses'), { target: { value: 'All courses' } });
        const props = (state().globalSettings as Record<string, any>).layout.footer.props;
        expect(props.rightSection1.links[0]).toMatchObject({ label: 'All courses', route: 'courses' });
        expect(props).toMatchObject({
            variant: 'brand',
            leftSection: { tagline: 'Translate Knowledge' },
            rightSection4: footer.props.rightSection4,
            newsletter: footer.props.newsletter,
            bottomTagline: 'Made with care',
        });
    });
});
