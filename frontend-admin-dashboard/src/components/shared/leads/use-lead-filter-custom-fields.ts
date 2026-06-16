import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDisplaySettingsWithFallback } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';
import { useCustomFieldSetup } from '@/routes/audience-manager/list/-hooks/useCustomFieldSetup';

export interface LeadFilterCustomField {
    customFieldId: string;
    fieldName: string;
    fieldType: string;
}

/**
 * The custom fields the admin has enabled as leads filters (configured in
 * Display Settings → Content & Learners, stored in the admin display-settings
 * blob), resolved against the institute's live custom-field catalog so a
 * deleted/renamed field stays correct. Order follows the catalog's form_order.
 *
 * Gating: when no fields are enabled the list is empty, so the leads views
 * render no custom-field controls and never call the distinct-values API. The
 * catalog fetch only runs when there is at least one enabled field.
 */
export function useLeadFilterCustomFields(instituteId?: string): {
    fields: LeadFilterCustomField[];
    isLoading: boolean;
} {
    const { data: displaySettings, isLoading: settingLoading } = useQuery({
        queryKey: ['display-settings', ADMIN_DISPLAY_SETTINGS_KEY, 'leads-filter-custom-fields'],
        queryFn: () => getDisplaySettingsWithFallback(ADMIN_DISPLAY_SETTINGS_KEY),
        enabled: Boolean(instituteId),
        // Refresh on mount so a just-saved settings change shows up when the
        // admin navigates to the leads views. The fetch is localStorage-backed
        // (24h cache) so this stays cheap.
        staleTime: 0,
    });

    const enabledIds = useMemo(
        () => displaySettings?.leadsFilterCustomFields ?? [],
        [displaySettings]
    );
    const hasEnabled = enabledIds.length > 0;

    // Only fetch the catalog when at least one field is enabled.
    const { data: setup, isLoading: setupLoading } = useCustomFieldSetup(
        hasEnabled ? instituteId : undefined
    );

    const fields = useMemo<LeadFilterCustomField[]>(() => {
        if (!hasEnabled || !setup) return [];
        const enabledSet = new Set(enabledIds);
        return setup
            .filter((f) => enabledSet.has(f.custom_field_id))
            .sort((a, b) => (a.form_order ?? 0) - (b.form_order ?? 0))
            .map((f) => ({
                customFieldId: f.custom_field_id,
                fieldName: f.field_name,
                fieldType: f.field_type,
            }));
    }, [hasEnabled, setup, enabledIds]);

    return {
        fields,
        isLoading: settingLoading || (hasEnabled && setupLoading),
    };
}
