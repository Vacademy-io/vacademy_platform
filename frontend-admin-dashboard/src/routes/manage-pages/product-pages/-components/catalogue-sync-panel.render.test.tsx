import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogueSyncPanel } from './CatalogueSyncPanel';

/**
 * "Sync all catalogue courses" saves on the server at once, so it must wait
 * for unsaved edits, ask first, hand the fresh page back for the rows to be
 * re-seeded, and say what it did.
 */

const sync = vi.fn();
const getPage = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('../-services/product-pages-service', () => ({
    syncProductPageCatalogue: (...args: unknown[]) => sync(...args),
    getProductPage: (...args: unknown[]) => getPage(...args),
}));
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQueryClient: () => ({ invalidateQueries }),
}));

const freshPage = { id: 'pp-1', name: 'Store', code: 'store', mappings: [{ id: 'm1' }, { id: 'm2' }] };

const confirmSync = () => {
    fireEvent.click(screen.getByRole('button', { name: /Sync all catalogue courses/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
};

beforeEach(() => {
    sync.mockReset();
    getPage.mockReset();
    invalidateQueries.mockReset();
});

describe('CatalogueSyncPanel', () => {
    it('waits while the editor has unsaved changes', () => {
        render(<CatalogueSyncPanel productPageId="pp-1" instituteId="inst-1" isDirty onSynced={vi.fn()} />);
        expect(screen.getByRole('button', { name: /Sync all catalogue courses/ })).toBeDisabled();
        expect(screen.getByText(/Save your changes first/)).toBeInTheDocument();
    });

    it('asks first, syncs, hands back the fresh page and summarises', async () => {
        sync.mockResolvedValue({
            ...freshPage,
            added: 2,
            deactivated: 1,
            skipped: [
                { package_session_id: 'ps-9', reason: 'Instalment plan (CPO)' },
                { package_session_id: 'ps-8', reason: 'Instalment plan (CPO)' },
            ],
            warnings: ['Courses use two payment gateways; checkout charges through the first.'],
        });
        const onSynced = vi.fn();
        render(<CatalogueSyncPanel productPageId="pp-1" instituteId="inst-1" onSynced={onSynced} />);

        fireEvent.click(screen.getByRole('button', { name: /Sync all catalogue courses/ }));
        // Nothing is sent until confirmed.
        expect(sync).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

        await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
        expect(sync).toHaveBeenCalledWith('pp-1', 'inst-1', { deactivateMissing: true });
        expect(onSynced.mock.calls[0]![0]).toMatchObject({ id: 'pp-1', code: 'store' });
        expect(getPage).not.toHaveBeenCalled();
        expect(
            await screen.findByText('Added 2 course versions · switched off 1 no longer in the catalogue · 2 not added')
        ).toBeInTheDocument();
        expect(screen.getByText('Instalment plan (CPO) — 2')).toBeInTheDocument();
        expect(screen.getByText(/two payment gateways/)).toBeInTheDocument();
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['PP_OFFER_PREVIEW'] });
    });

    it('can keep courses that left the catalogue', async () => {
        sync.mockResolvedValue({ ...freshPage, added: 0 });
        render(<CatalogueSyncPanel productPageId="pp-1" instituteId="inst-1" onSynced={vi.fn()} />);
        fireEvent.click(screen.getByRole('checkbox'));
        confirmSync();
        await waitFor(() => expect(sync).toHaveBeenCalledWith('pp-1', 'inst-1', { deactivateMissing: false }));
        expect(await screen.findByText('Nothing new to add')).toBeInTheDocument();
    });

    it('refetches the page when the response carries none', async () => {
        sync.mockResolvedValue({ added: 1 });
        getPage.mockResolvedValue(freshPage);
        const onSynced = vi.fn();
        render(<CatalogueSyncPanel productPageId="pp-1" instituteId="inst-1" onSynced={onSynced} />);
        confirmSync();
        await waitFor(() => expect(onSynced).toHaveBeenCalledWith(freshPage));
        expect(getPage).toHaveBeenCalledWith('pp-1');
    });

    it('shows the server’s reason when the sync fails and re-seeds nothing', async () => {
        sync.mockRejectedValue({ response: { data: { ex: 'Only institute admins can sync' } } });
        const onSynced = vi.fn();
        render(<CatalogueSyncPanel productPageId="pp-1" instituteId="inst-1" onSynced={onSynced} />);
        confirmSync();
        expect(await screen.findByText('Only institute admins can sync')).toBeInTheDocument();
        expect(onSynced).not.toHaveBeenCalled();
    });
});
