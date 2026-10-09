import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FolderNodeEditorDialog } from './FolderNodeEditorDialog';
import type { FolderNode } from '../../-services/folder-library-service';

/**
 * The folder item dialog's Advanced section: the fields the mega menu, the
 * Courses page tabs and learning-path cards read. An item that never opens
 * it must save exactly as before; what is set must be validated the way the
 * server will, and only what changed is sent.
 */

vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('../ImageUploadField', () => ({ ImageUploadField: () => null }));
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
        queryKey[0] === 'campaignsList'
            ? {
                  data: { content: [{ id: 'aud-1', campaign_name: 'Notify me — Ayurveda' }] },
                  isLoading: false,
              }
            : { data: [], isLoading: false },
}));

const existing = (over: Partial<FolderNode> = {}): FolderNode => ({
    id: 'f-1',
    node_type: 'FOLDER',
    title: 'Shiksha',
    description: 'All about learning',
    image_url: '',
    display_order: 0,
    status: 'ACTIVE',
    children: [],
    ...over,
});

const setup = (props: Partial<React.ComponentProps<typeof FolderNodeEditorDialog>> = {}) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
        <FolderNodeEditorDialog
            open
            onOpenChange={onOpenChange}
            nodeType="FOLDER"
            node={null}
            parentLabel="Streams"
            onSubmit={onSubmit}
            {...props}
        />
    );
    return { onSubmit, onOpenChange };
};

const openAdvanced = () => fireEvent.click(screen.getByRole('button', { name: /Advanced/ }));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('FolderNodeEditorDialog → Advanced', () => {
    it('saves an untouched folder exactly as before (no new fields sent)', async () => {
        const { onSubmit } = setup({ node: existing() });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]![0]).toEqual({
            title: 'Shiksha',
            description: 'All about learning',
            image_url: '',
            status: 'ACTIVE',
            view: {},
        });
    });

    it('suggests a link key from the subtitle and sends the fields that were set', async () => {
        const { onSubmit } = setup();
        fireEvent.change(screen.getByPlaceholderText('e.g. Class 10'), { target: { value: 'शिक्षा' } });
        openAdvanced();
        fireEvent.change(screen.getByPlaceholderText('e.g. EDUCATION'), { target: { value: 'EDUCATION' } });
        expect(screen.getByText(/Links use “education”, made from the subtitle/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Use “education”' }));
        expect(screen.getByDisplayValue('education')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create folder' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]![0]).toEqual({
            title: 'शिक्षा',
            description: '',
            image_url: '',
            status: 'ACTIVE',
            subtitle: 'EDUCATION',
            slug: 'education',
            view: {},
        });
    });

    it('warns when a Hindi-only title leaves no readable link key', () => {
        setup();
        fireEvent.change(screen.getByPlaceholderText('e.g. Class 10'), { target: { value: 'शिक्षा' } });
        openAdvanced();
        expect(screen.getByText(/fall back to this folder’s internal id/)).toBeInTheDocument();
    });

    it('refuses an unsafe link before saving', async () => {
        const { onSubmit } = setup({ node: existing() });
        openAdvanced();
        fireEvent.change(screen.getByPlaceholderText('/courses?stream=shiksha'), {
            target: { value: 'javascript:alert(1)' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText(/The link must be a page on your site/)).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('flags a link key another folder already uses', () => {
        setup({ takenSlugs: new Map([['education', 'Shiksha']]) });
        openAdvanced();
        fireEvent.change(screen.getByPlaceholderText('e.g. EDUCATION'), { target: { value: 'Education' } });
        expect(screen.getByText(/“Shiksha” already uses the link key “education”/)).toBeInTheDocument();
    });

    it('marks a folder coming soon with a sign-up campaign', async () => {
        const { onSubmit } = setup({ node: existing() });
        openAdvanced();
        fireEvent.click(screen.getByRole('switch', { name: 'Coming soon' }));
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'aud-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]![0]).toMatchObject({ coming_soon: true, audience_id: 'aud-1' });
    });

    it('opens by itself for an item that already uses it, and clears a field with ""', async () => {
        const { onSubmit } = setup({ node: existing({ subtitle: 'EDUCATION', tagline: 'Learn the Indian way' }) });
        const tagline = screen.getByDisplayValue('Learn the Indian way');
        fireEvent.change(tagline, { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0]![0]).toMatchObject({ tagline: '' });
        expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('subtitle');
    });

    it('offers only card fields for a product-page item', () => {
        setup({ nodeType: 'PRODUCT_PAGE', node: { ...existing(), node_type: 'PRODUCT_PAGE', product_page_id: 'pp-1' } });
        openAdvanced();
        expect(screen.getByPlaceholderText('e.g. EDUCATION')).toBeInTheDocument();
        expect(screen.queryByText('Link key (optional)')).not.toBeInTheDocument();
        expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
    });
});
