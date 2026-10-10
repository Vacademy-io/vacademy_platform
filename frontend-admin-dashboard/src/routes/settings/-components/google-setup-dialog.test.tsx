import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import copy from '../../../../public/locales/en/settingsIntegration.json';
import { formatDateTime } from '@/lib/formatters';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GoogleSetupDialog } from './IntegrationSettings';
import type { ConnectorListItem } from '../-services/ad-platform-service';

vi.mock('@/lib/auth/axiosInstance', () => ({
    default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));
vi.mock('@/lib/auth/instituteUtils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/auth/instituteUtils')>()),
    getCurrentInstituteId: () => 'inst-1',
}));

const api = authenticatedAxiosInstance as unknown as {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
};

const i18n = createInstance();
void i18n.init({
    lng: 'en',
    resources: { en: { settingsIntegration: copy } },
    interpolation: { escapeValue: false },
});

const KEY = 'Zk3vQp9LmN2xR7tY4wB8cD1eF6gH0jKs';

function connector(overrides: Partial<ConnectorListItem> = {}): ConnectorListItem {
    return {
        id: 'conn-1',
        vendor: 'GOOGLE_LEAD_ADS',
        vendorId: KEY,
        audienceId: 'aud-1',
        platformPageId: null,
        platformFormId: KEY,
        platformFormName: null,
        connectionStatus: 'ACTIVE',
        statusDetail: null,
        lastCheckedAt: null,
        producesSourceType: 'GOOGLE_ADS',
        createdAt: null,
        tokenExpiresAt: null,
        defaultValuesJson: null,
        ...overrides,
    };
}

const CAMPAIGNS = [
    {
        campaign: '22173284076',
        people: 4,
        first_seen: '2026-10-09T15:52:05.915+00:00',
        last_seen: '2026-10-10T06:11:44.706+00:00',
        name: 'Pune MBBS Search',
    },
    {
        campaign: '22206499349',
        people: 1,
        first_seen: '2026-10-10T07:05:24.222+00:00',
        last_seen: '2026-10-10T07:05:24.222+00:00',
        name: null,
    },
];

function mount(c: ConnectorListItem | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={client}>
                <GoogleSetupDialog
                    connector={c}
                    audienceName="NEET 2027"
                    open
                    onOpenChange={() => {}}
                />
            </QueryClientProvider>
        </I18nextProvider>
    );
}

beforeEach(() => {
    api.get.mockReset();
    api.put.mockReset();
    api.get.mockImplementation((url: string) =>
        Promise.resolve({ data: url.includes('/utm/campaigns') ? CAMPAIGNS : {} })
    );
});

describe('GoogleSetupDialog', () => {
    it('shows the URL, the key, the steps and a waiting status before Google has called', () => {
        mount(connector());
        expect(screen.getByText(new RegExp(`/webhook/google/${KEY}$`))).toBeTruthy();
        expect(screen.getByText(KEY)).toBeTruthy();
        expect(screen.getByText(/Leads from this connector go to NEET 2027/)).toBeTruthy();
        expect(screen.getByText(/Click "Send test data"/)).toBeTruthy();
        expect(screen.getByText(/Nothing received from Google yet/)).toBeTruthy();
        expect(screen.getByText(/"Unauthorized" \(401\)/)).toBeTruthy();
    });

    it('confirms delivery in local time, reading the server timestamp as UTC', () => {
        mount(connector({ lastCheckedAt: '2026-10-08T14:05:03.123' }));
        const local = formatDateTime(new Date('2026-10-08T14:05:03.123Z'), { second: '2-digit' });
        expect(
            screen.getByText(`Google reached this connector on ${local}. The setup works.`)
        ).toBeTruthy();
    });

    it('shows why the last delivery failed', () => {
        mount(
            connector({
                lastCheckedAt: '2026-10-08T14:05:03',
                connectionStatus: 'ACTION_REQUIRED',
                statusDetail: 'Google reached this connector, but the Key does not match.',
            })
        );
        expect(screen.getByText(/the Key does not match/)).toBeTruthy();
        expect(screen.queryByText(/The setup works/)).toBeNull();
    });

    it('waits for the list refetch when the connector was just created', () => {
        mount(null);
        expect(screen.getByText(copy.activeConnectors.loading)).toBeTruthy();
    });

    it('lists the campaigns that sent leads, with their saved names', async () => {
        mount(connector());
        expect(await screen.findByText('22173284076')).toBeTruthy();
        expect(screen.getByDisplayValue('Pune MBBS Search')).toBeTruthy();
        expect(screen.getByText(/Leads: 4/)).toBeTruthy();
        expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/utm/campaigns'), {
            params: { instituteId: 'inst-1', source: 'google', medium: 'lead_form' },
        });
    });

    it('saves only the campaign names that changed', async () => {
        api.put.mockResolvedValue({ data: { labels: {} } });
        mount(connector());
        await screen.findByText('22206499349');
        const save = screen.getByRole('button', { name: copy.google.campaignsSave });
        expect((save as HTMLButtonElement).disabled).toBe(true);

        const unnamed = screen.getAllByPlaceholderText(copy.google.campaignNamePlaceholder)[1]!;
        fireEvent.change(unnamed, { target: { value: '  Pune NEET Display  ' } });
        fireEvent.click(save);

        await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
        expect(api.put).toHaveBeenCalledWith(
            expect.stringContaining('/utm/campaign-labels'),
            { labels: { '22206499349': 'Pune NEET Display' } },
            { params: { instituteId: 'inst-1' } }
        );
    });

    it('never shows the key as the connector name', () => {
        mount(connector({ platformFormName: 'Admissions lead form' }));
        expect(screen.getByDisplayValue('Admissions lead form')).toBeTruthy();
    });
});
