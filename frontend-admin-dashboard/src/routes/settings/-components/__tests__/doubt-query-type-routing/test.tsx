import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DoubtManagementSettings from '@/routes/settings/-components/DoubtManagementSettings';

const STORED_SETTINGS = {
    default_assignee_source: 'BATCH_TEACHER',
    fallback_to_batch_when_no_subject_teacher: true,
    // The built-in type as every existing institute has it stored: no per-type assignee, so it
    // rides on default_assignee_source.
    query_types: [
        { key: 'DOUBT', label: 'Doubt', enabled: true, is_system: true, learner_selectable: true },
        {
            key: 'TECHNICAL',
            label: 'Technical Issue',
            enabled: true,
            learner_selectable: true,
            assignee: { source: 'ROLE', role: 'ADMIN' },
        },
    ],
};

const axiosGet = vi.fn<unknown[], Promise<{ data: unknown }>>(async () => ({ data: [] }));
const axiosPost = vi.fn<unknown[], Promise<{ data: unknown }>>(async () => ({ data: {} }));
const axiosCall = vi.fn<unknown[], Promise<{ data: unknown }>>(async () => ({
    data: { data: structuredClone(STORED_SETTINGS) },
}));

// Lazy wrappers: the mock factory runs while the module graph is still loading, before the consts
// above are initialized.
vi.mock('@/lib/auth/axiosInstance', () => ({
    __esModule: true,
    default: Object.assign((...args: unknown[]) => axiosCall(...args), {
        get: (...args: unknown[]) => axiosGet(...args),
        post: (...args: unknown[]) => axiosPost(...args),
    }),
}));

vi.mock('@/lib/auth/instituteUtils', () => ({
    getCurrentInstituteId: () => 'inst-1',
}));

vi.mock('@/hooks/usePushNotifications', () => ({
    usePushNotifications: () => ({ ensurePermission: vi.fn(async () => true) }),
}));

vi.mock('@/routes/dashboard/-hooks/useInstituteAssignees', () => ({
    useInstituteAssignees: () => ({
        assignees: [
            { id: 'u-1', name: 'Asha Rao', subtitle: 'Teacher' },
            { id: 'u-2', name: 'Vikram Shah', subtitle: 'Evaluator' },
        ],
        isLoading: false,
    }),
}));

vi.mock('@/components/common/layout-container/sidebar/utils', () => ({
    getTerminology: (term: string) => term,
}));

vi.mock('@/routes/settings/-components/NamingSettings', () => ({
    OtherTerms: { SubOrg: 'Sub-organization' },
    SystemTerms: { SubOrg: 'Sub-organization' },
}));

const renderScreen = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DoubtManagementSettings />
        </QueryClientProvider>
    );
};

/** The Query-types row whose name input holds `label`. */
const typeCard = (label: string): HTMLElement => {
    const input = screen.getByDisplayValue(label);
    const card = input.closest('div.rounded-lg');
    if (!card) throw new Error(`no card for ${label}`);
    return card as HTMLElement;
};

const routeSelect = (label: string): HTMLSelectElement =>
    within(typeCard(label)).getAllByRole('combobox')[0] as HTMLSelectElement;

const savedPayload = () =>
    (axiosPost.mock.calls[0]?.[1] as { setting_data: { query_types: Record<string, unknown>[] } })
        ?.setting_data;

const savedType = (key: string) =>
    savedPayload().query_types.find((t) => t.key === key) as {
        assignee?: { source?: string; user_ids?: string[] };
    };

const save = async () => {
    fireEvent.click(screen.getByText('Save settings'));
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(1));
};

describe('Query types — built-in Doubt routing', () => {
    beforeAll(() => {
        // jsdom has no layout engine; cmdk scrolls its active item into view when the staff
        // picker opens.
        Element.prototype.scrollIntoView = vi.fn();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lets the admin re-route the built-in Doubt type instead of locking the picker', async () => {
        renderScreen();
        await screen.findByText('Query types');

        const select = routeSelect('Doubt');
        expect(select).not.toBeDisabled();
        // A stored type with no assignee shows as inheriting, not as a fake "Subject teacher".
        expect(select.value).toBe('DEFAULT');
        expect(
            within(typeCard('Doubt')).getByText(/follows .Default auto-assignment. above/)
        ).toBeInTheDocument();

        fireEvent.change(select, { target: { value: 'SUBJECT_TEACHER' } });
        await save();
        expect(savedType('DOUBT').assignee).toEqual({ source: 'SUBJECT_TEACHER' });
    });

    it('keeps the payload free of a Doubt assignee while it inherits the global default', async () => {
        renderScreen();
        await screen.findByText('Query types');

        // Change something else so Save is enabled without touching Doubt's routing.
        fireEvent.change(routeSelect('Technical Issue'), { target: { value: 'BATCH_TEACHER' } });
        await save();
        expect(savedType('DOUBT').assignee).toBeUndefined();
    });

    it('reverting to the default clears a previously saved Doubt override', async () => {
        renderScreen();
        await screen.findByText('Query types');

        const select = routeSelect('Doubt');
        fireEvent.change(select, { target: { value: 'SPECIFIC_USERS' } });
        fireEvent.change(select, { target: { value: 'DEFAULT' } });
        await save();
        expect(savedType('DOUBT').assignee).toBeUndefined();
    });

    it('offers the staff picker on the Doubt type and saves the picked handlers', async () => {
        renderScreen();
        await screen.findByText('Query types');

        fireEvent.change(routeSelect('Doubt'), { target: { value: 'SPECIFIC_USERS' } });

        const card = typeCard('Doubt');
        expect(within(card).getByText('Staff handlers')).toBeInTheDocument();
        // Empty selection is spelled out rather than silently routing to admins.
        expect(within(card).getByText(/Nobody picked yet/)).toBeInTheDocument();

        fireEvent.click(within(card).getByText('Select...'));
        fireEvent.click(await screen.findByText(/Asha Rao/));

        await save();
        expect(savedType('DOUBT').assignee).toMatchObject({
            source: 'SPECIFIC_USERS',
            user_ids: ['u-1'],
        });
    });
});
