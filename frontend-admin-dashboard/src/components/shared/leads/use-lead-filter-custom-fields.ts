import {
    useListCustomFieldControls,
    type ListCustomFieldControlField,
} from './use-list-custom-field-controls';

export type LeadFilterCustomField = ListCustomFieldControlField;

/**
 * The custom fields enabled as leads filters. Thin wrapper over
 * useListCustomFieldControls('LEADS', …), which reads the unified
 * listCustomFieldControls settings with a fallback to the legacy
 * leadsFilterCustomFields key — kept so the leads pages' call sites and the
 * original gating semantics stay unchanged.
 */
export function useLeadFilterCustomFields(instituteId?: string): {
    fields: LeadFilterCustomField[];
    isLoading: boolean;
} {
    const { fields, isLoading } = useListCustomFieldControls('LEADS', instituteId);
    return { fields, isLoading };
}
