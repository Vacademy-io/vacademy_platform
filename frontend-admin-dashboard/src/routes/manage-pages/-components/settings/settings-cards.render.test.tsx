import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CourseLanguagesSettingsCard } from './CourseLanguagesSettingsCard';
import { SiteCartSettingsCard } from './SiteCartSettingsCard';
import { DEFAULT_COURSE_LANGUAGES } from './course-languages';

/**
 * The two Knowledge Streams cards in Global Settings: course languages
 * (how a level name tells its language) and the site cart (which product
 * page checks the whole cart out).
 */

let productPages: any[] = [];

vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
        queryKey[0] === 'PRODUCT_PAGES_FOR_CATALOGUE'
            ? { data: productPages, isLoading: false, isError: false }
            : { data: undefined, isLoading: false, isError: false },
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('../../product-pages/-services/product-pages-service', () => ({
    getAllProductPages: vi.fn(),
    getProductPage: vi.fn(),
    syncProductPageCatalogue: vi.fn(),
}));

beforeEach(() => {
    productPages = [];
});

describe('CourseLanguagesSettingsCard', () => {
    it('shows the built-in English / Hindi rules once switched on', () => {
        render(<CourseLanguagesSettingsCard value={{ enabled: true }} onChange={vi.fn()} />);
        expect(screen.getByDisplayValue('English')).toBeInTheDocument();
        expect(screen.getByDisplayValue('हिं')).toBeInTheDocument();
        expect(screen.getByDisplayValue('hindi, हिन्दी, हिंदी')).toBeInTheDocument();
        expect(screen.queryByText('Reset to English / Hindi')).not.toBeInTheDocument();
    });

    it('turns the defaults into the site’s own list on the first edit', () => {
        const onChange = vi.fn();
        render(<CourseLanguagesSettingsCard value={{ enabled: true }} onChange={onChange} />);
        fireEvent.change(screen.getByDisplayValue('हिं'), { target: { value: 'HI' } });
        expect(onChange).toHaveBeenCalledWith({
            enabled: true,
            languages: [DEFAULT_COURSE_LANGUAGES[0], { ...DEFAULT_COURSE_LANGUAGES[1], chip: 'HI' }],
        });
    });

    it('commits match words on blur, not on every keystroke', () => {
        const onChange = vi.fn();
        render(<CourseLanguagesSettingsCard value={{ enabled: true }} onChange={onChange} />);
        const words = screen.getByDisplayValue('english, eng');
        fireEvent.change(words, { target: { value: 'english, eng, ' } });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.change(words, { target: { value: 'english, eng, angrezi' } });
        fireEvent.blur(words);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]![0].languages[0].match).toEqual(['english', 'eng', 'angrezi']);
    });

    it('resets a custom list back to the defaults by removing it', () => {
        const onChange = vi.fn();
        render(
            <CourseLanguagesSettingsCard
                value={{ enabled: true, languages: [{ code: 'ta', label: 'Tamil', match: ['tamil'] }] }}
                onChange={onChange}
            />
        );
        fireEvent.click(screen.getByText('Reset to English / Hindi'));
        expect(onChange).toHaveBeenCalledWith({ enabled: true, languages: undefined });
    });

    it('answers what a level name will be read as', () => {
        render(<CourseLanguagesSettingsCard value={{ enabled: true }} onChange={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('e.g. Beginner Hindi'), { target: { value: 'Beginner Hindi' } });
        expect(screen.getByText('→ Hindi (हिं)')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('e.g. Beginner Hindi'), { target: { value: 'Engineering' } });
        expect(screen.getByText(/No language recognised/)).toBeInTheDocument();
    });

    it('warns about duplicate codes', () => {
        render(
            <CourseLanguagesSettingsCard
                value={{
                    enabled: true,
                    languages: [
                        { code: 'hi', label: 'Hindi' },
                        { code: 'hi', label: 'Hinglish' },
                    ],
                }}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText(/used twice/)).toBeInTheDocument();
    });
});

describe('SiteCartSettingsCard', () => {
    it('stays quiet while off', () => {
        render(<SiteCartSettingsCard value={undefined} onChange={vi.fn()} />);
        expect(screen.queryByText('Store product page')).not.toBeInTheDocument();
    });

    it('picks a store page by code and name', () => {
        productPages = [
            { id: 'pp-1', code: 'store', name: 'Store', status: 'ACTIVE' },
            { id: 'pp-2', code: 'draft', name: 'Draft page', status: 'DRAFT' },
        ];
        const onChange = vi.fn();
        render(<SiteCartSettingsCard value={{ enabled: true }} onChange={onChange} />);
        expect(screen.getByText('The cart stays off until a store page is chosen.')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Store product page'), { target: { value: 'store' } });
        expect(onChange).toHaveBeenCalledWith({
            enabled: true,
            storeProductPageCode: 'store',
            storeProductPageName: 'Store',
        });
    });

    it('offers the catalogue sync and the store page once a store is chosen', () => {
        productPages = [{ id: 'pp-1', code: 'store', name: 'Store', status: 'ACTIVE' }];
        render(
            <SiteCartSettingsCard
                value={{ enabled: true, storeProductPageCode: 'store', storeProductPageName: 'Store' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText('Sync all catalogue courses')).toBeInTheDocument();
        expect(screen.getByText('Open the store page').closest('a')).toHaveAttribute(
            'href',
            '/manage-pages/product-pages/editor/pp-1'
        );
    });

    it('flags a store page that no longer exists', () => {
        productPages = [{ id: 'pp-1', code: 'store', name: 'Store', status: 'ACTIVE' }];
        render(
            <SiteCartSettingsCard
                value={{ enabled: true, storeProductPageCode: 'gone', storeProductPageName: 'Old store' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByText(/no longer exists/)).toBeInTheDocument();
        expect(screen.queryByText('Sync all catalogue courses')).not.toBeInTheDocument();
    });
});
