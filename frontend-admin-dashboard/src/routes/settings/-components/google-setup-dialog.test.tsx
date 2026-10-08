import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import copy from '../../../../public/locales/en/settingsIntegration.json';
import { formatDateTime } from '@/lib/formatters';
import { GoogleSetupDialog } from './IntegrationSettings';
import type { ConnectorListItem } from '../-services/ad-platform-service';

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

function mount(c: ConnectorListItem | null) {
    return render(
        <I18nextProvider i18n={i18n}>
            <GoogleSetupDialog
                connector={c}
                audienceName="NEET 2027"
                open
                onOpenChange={() => {}}
            />
        </I18nextProvider>
    );
}

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
});
