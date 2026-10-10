import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { CatalogueEditorPage } from './CatalogueEditorPage';
import { useEditorStore } from '../-stores/editor-store';
import * as service from '../-services/catalogue-service';

/**
 * The editor's draft guard. The 2026-10-09 incident: Python-written live JSON
 * made the editor look edited on open, autosave turned that into a draft, and
 * a later Publish would have rolled the live site back to it.
 */

vi.mock('react-i18next', async () => {
    const en = (await import('../../../../public/locales/en/managePagesCatalogueEditor.json'))
        .default;
    const t = (key: string, opts?: Record<string, unknown>) => {
        const value = key
            .split('.')
            .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
        return typeof value === 'string'
            ? value.replace(/{{(\w+)}}/g, (_, name: string) => String(opts?.[name] ?? ''))
            : key;
    };
    return { useTranslation: () => ({ t, i18n: { language: 'en' } }) };
});
vi.mock('../editor/$tagName', () => ({
    Route: { useParams: () => ({ tagName: 'brahm-varchas' }), useSearch: () => ({}) },
}));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('../-hooks/use-catalogue-permissions', () => ({
    useCataloguePermissions: () => ({ canWrite: true }),
}));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('../-services/catalogue-service', () => ({
    getCatalogueMeta: vi.fn(),
    getDraftRevision: vi.fn(),
    saveDraftRevision: vi.fn(),
    publishDraftRevision: vi.fn(),
    discardDraftRevision: vi.fn(),
    getRevisionHistory: vi.fn(),
}));
vi.mock('../-utils/publish-checks', () => ({ runPublishChecks: () => [] }));
// The panels around the canvas are not under test here.
vi.mock('./ComponentLibrary', () => ({ ComponentLibrary: () => null }));
vi.mock('./TemplateLibrary', () => ({ TemplateLibrary: () => null }));
vi.mock('./LayersPanel', () => ({ LayersPanel: () => null }));
vi.mock('./PropertyPanel', () => ({ PropertyPanel: () => null }));
vi.mock('./PageTabs', () => ({ PageTabs: () => null }));
vi.mock('./CanvasRenderer', () => ({ CanvasRenderer: () => null }));
vi.mock('./AiCopilotPanel', () => ({ AiCopilotPanel: () => null }));
vi.mock('./AiChromePanel', () => ({ AiChromePanel: () => null }));
vi.mock('./SiteAnalyticsPanel', () => ({ SiteAnalyticsPanel: () => null }));
vi.mock('./RevisionHistoryDialog', () => ({ RevisionHistoryDialog: () => null }));
vi.mock('./PublishCheckDialog', () => ({ PublishCheckDialog: () => null }));
vi.mock('./blog/BlogManagerDialog', () => ({ BlogManagerDialog: () => null }));
vi.mock('./folders/FolderLibraryDialog', () => ({ FolderLibraryDialog: () => null }));
vi.mock('./i18n/EditingLanguageToggle', () => ({ EditingLanguageToggle: () => null }));
vi.mock('./i18n/LocalizedEditingBar', () => ({ LocalizedEditingBar: () => null }));
vi.mock('@/components/shared/freebies/FreebieDownloadsPanel', () => ({
    FreebieDownloadsPanel: () => null,
}));

const api = vi.mocked(service);

const LIVE = {
    globalSettings: { mode: 'light', i18n: { locales: ['hi'] } },
    pages: [
        {
            id: 'home',
            route: 'home',
            title: 'Home',
            components: [{ id: 'hero', type: 'hero', props: { title: 'नमस्ते, ब्रह्म वर्चस' } }],
        },
        { id: 'courses', route: 'courses', title: 'Courses', components: [] },
    ],
};
// The draft from before the live site's Figma rework: one stray prop differs.
const OLD = {
    ...LIVE,
    pages: [
        {
            ...LIVE.pages[0]!,
            components: [{ id: 'hero', type: 'hero', props: { title: 'Old title' } }],
        },
    ],
};

/** What Python's json.dumps(..., ensure_ascii=False) writes: ", " and ": ". */
const pyDumps = (v: unknown): string =>
    Array.isArray(v)
        ? `[${v.map(pyDumps).join(', ')}]`
        : v && typeof v === 'object'
          ? `{${Object.entries(v)
                .map(([k, x]) => `${JSON.stringify(k)}: ${pyDumps(x)}`)
                .join(', ')}}`
          : JSON.stringify(v);

const meta = (json = pyDumps(LIVE)) => ({ id: 'cat-1', catalogue_json: json, status: 'ACTIVE' });
const draft = (over: Partial<service.CatalogueRevision> = {}): service.CatalogueRevision => ({
    id: 'rev-1',
    revision_no: 1,
    status: 'DRAFT',
    source: 'MANUAL',
    created_at: '2026-10-09T15:00:28Z',
    updated_at: '2026-10-09T15:00:28Z',
    catalogue_json: JSON.stringify(OLD),
    ...over,
});
const HISTORY: service.CatalogueRevision[] = [
    {
        id: 'rev-5',
        revision_no: 5,
        status: 'PUBLISHED',
        source: 'LEGACY_UPDATE',
        updated_at: '2026-10-09T18:30:00Z',
    },
    {
        id: 'rev-1',
        revision_no: 1,
        status: 'DRAFT',
        source: 'MANUAL',
        created_at: '2026-10-09T15:00:28Z',
    },
];

const renderEditor = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <CatalogueEditorPage />
        </QueryClientProvider>
    );
};
const loaded = () => screen.findByText('Save draft');
const banner = () => screen.queryByRole('alert');

beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ config: null, history: [], historyIndex: -1, activeTab: 'visual' });
    api.getCatalogueMeta.mockResolvedValue(meta());
    api.getDraftRevision.mockResolvedValue(null);
    api.getRevisionHistory.mockResolvedValue(HISTORY);
    api.saveDraftRevision.mockImplementation(async () => draft());
    api.publishDraftRevision.mockResolvedValue(draft({ status: 'PUBLISHED' }));
    api.discardDraftRevision.mockResolvedValue(undefined);
});
afterEach(() => {
    vi.useRealTimers();
});

describe('opening the editor', () => {
    it('Python-formatted live JSON opens clean, and autosave never fires', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderEditor();
        await loaded();
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
        await act(async () => {
            vi.advanceTimersByTime(60_000);
        });
        expect(api.saveDraftRevision).not.toHaveBeenCalled();
    });

    it('a real edit autosaves, keeping the draft source instead of forcing MANUAL', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderEditor();
        await loaded();
        const edited = {
            ...LIVE,
            pages: [...LIVE.pages, { id: 'about', route: 'about', components: [] }],
        };
        act(() => useEditorStore.getState().updateConfig(edited as never));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        await act(async () => {
            vi.advanceTimersByTime(46_000);
        });
        await waitFor(() => expect(api.saveDraftRevision).toHaveBeenCalledTimes(1));
        expect(api.saveDraftRevision).toHaveBeenCalledWith('cat-1', edited, null);
    });
});

describe('a draft older than the live site', () => {
    it('shows the red banner, and "Use the live site" discards the draft and shows the live JSON', async () => {
        api.getDraftRevision.mockResolvedValue(draft());
        renderEditor();
        await loaded();
        await waitFor(() => expect(banner()).toBeInTheDocument());
        expect(banner()).toHaveTextContent('The live site changed after that (v5,');
        expect(banner()).toHaveTextContent('Publishing it would undo those changes.');
        // The editor opened the draft, as before.
        expect(useEditorStore.getState().config).toEqual(OLD);

        fireEvent.click(
            screen.getByRole('button', { name: 'Use the live site (discard this draft)' })
        );
        await waitFor(() => expect(api.discardDraftRevision).toHaveBeenCalledWith('cat-1'));
        await waitFor(() => expect(useEditorStore.getState().config).toEqual(LIVE));
        expect(banner()).not.toBeInTheDocument();
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(api.publishDraftRevision).not.toHaveBeenCalled();
    });

    it('trusts the server flag when the server sends one', async () => {
        api.getDraftRevision.mockResolvedValue(
            draft({
                live_changed_since_draft: true,
                live_revision_no: 7,
                live_updated_at: '2026-10-10T01:00:00Z',
            })
        );
        renderEditor();
        await loaded();
        await waitFor(() => expect(banner()).toHaveTextContent('(v7,'));
        expect(api.getRevisionHistory).not.toHaveBeenCalled();
    });

    it('shows no banner when the server says the draft is current', async () => {
        api.getDraftRevision.mockResolvedValue(draft({ live_changed_since_draft: false }));
        renderEditor();
        await loaded();
        expect(screen.getByText('Draft — not published')).toBeInTheDocument();
        expect(banner()).not.toBeInTheDocument();
    });

    it('Publish asks first, then publishes with overrideStale', async () => {
        api.getDraftRevision.mockResolvedValue(draft());
        renderEditor();
        await loaded();
        await waitFor(() => expect(banner()).toBeInTheDocument());
        fireEvent.click(screen.getByRole('button', { name: 'Keep my draft' }));
        expect(banner()).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('Publish an older draft?');
        expect(api.publishDraftRevision).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Publish anyway' }));
        await waitFor(() =>
            expect(api.publishDraftRevision).toHaveBeenCalledWith('cat-1', { overrideStale: true })
        );
    });

    it('a 409 from the server opens the same confirmation', async () => {
        api.getDraftRevision.mockResolvedValue(draft({ created_at: '2026-10-10T00:00:00Z' }));
        api.publishDraftRevision.mockRejectedValueOnce(
            new AxiosError('stale', '409', undefined, undefined, {
                status: 409,
                statusText: 'Conflict',
                data: { code: 'DRAFT_OLDER_THAN_LIVE' },
                headers: {},
                config: { headers: new AxiosHeaders() },
            })
        );
        renderEditor();
        await loaded();
        expect(banner()).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() =>
            expect(api.publishDraftRevision).toHaveBeenCalledWith('cat-1', { overrideStale: false })
        );
        expect(await screen.findByRole('alertdialog')).toHaveTextContent('Publish an older draft?');
    });
});

describe('Discard draft', () => {
    it('works for a current draft, after a confirmation', async () => {
        // Started after the live site last changed: not stale.
        api.getDraftRevision.mockResolvedValue(draft({ created_at: '2026-10-10T00:00:00Z' }));
        renderEditor();
        await loaded();
        expect(banner()).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
        const dialog = await screen.findByRole('alertdialog');
        expect(dialog).toHaveTextContent('Discard this draft?');
        expect(api.discardDraftRevision).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Discard draft' }));
        await waitFor(() => expect(api.discardDraftRevision).toHaveBeenCalledWith('cat-1'));
        await waitFor(() => expect(useEditorStore.getState().config).toEqual(LIVE));
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Discard draft' })).not.toBeInTheDocument();
    });

    it('is not offered when there is nothing to discard', async () => {
        renderEditor();
        await loaded();
        expect(screen.queryByRole('button', { name: 'Discard draft' })).not.toBeInTheDocument();
    });
});
