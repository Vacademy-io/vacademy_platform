import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeadSettings } from './use-lead-settings';

/**
 * useLeadTerminology — what this institute calls the built-in lead attributes.
 *
 * "Tier" and "Lead status" are platform concepts, but institutes migrating from
 * other CRMs know them by their own names (Eduzilla: "Interest Level" /
 * "Action Label"). Admins set the names in Lead Settings → Terminology; this
 * hook resolves them with the translated default as fallback so table headers,
 * filters, chips and settings screens all agree.
 */
export interface LeadTerminology {
    /** Label for the lead tier attribute (default "Tier"). */
    tier: string;
    /** Label for the lead pipeline status attribute (default "Lead status"). */
    leadStatus: string;
    isLoading: boolean;
}

export const DEFAULT_TIER_LABEL = 'Tier';
export const DEFAULT_LEAD_STATUS_LABEL = 'Lead status';

export function useLeadTerminology(options?: { skip?: boolean }): LeadTerminology {
    const { labels, isLoading } = useLeadSettings(options);
    const { t } = useTranslation('leadTerminology');
    return useMemo(
        () => ({
            tier: labels?.tier?.trim() || t('tier', { defaultValue: DEFAULT_TIER_LABEL }),
            leadStatus:
                labels?.leadStatus?.trim() ||
                t('leadStatus', { defaultValue: DEFAULT_LEAD_STATUS_LABEL }),
            isLoading,
        }),
        [labels?.tier, labels?.leadStatus, isLoading, t]
    );
}
