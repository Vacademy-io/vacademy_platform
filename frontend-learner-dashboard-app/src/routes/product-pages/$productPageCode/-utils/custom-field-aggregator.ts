import type { AggregatedCustomField, ProductPageMappingResponse } from '../-types/product-page-types';

/**
 * Returns the subset of aggregated fields that are relevant to the currently
 * selected mappings. A field is included if at least one of its owning invites
 * belongs to a selected mapping.
 */
export function getActiveFields(
    allMappings: ProductPageMappingResponse[],
    selectedPsOptionIds: string[],
    allAggregatedFields: AggregatedCustomField[]
): AggregatedCustomField[] {
    const activeInviteIds = new Set(
        allMappings
            .filter((m) => selectedPsOptionIds.includes(m.ps_invite_payment_option_id))
            .map((m) => m.enroll_invite_id)
    );

    return allAggregatedFields.filter((f) =>
        f.enroll_invite_ids.some((id) => activeInviteIds.has(id))
    );
}

/**
 * Returns the initial set of selected ps_invite_payment_option_ids.
 * Priority: ?courseIds= URL param (comma-separated package_session_ids) →
 * fallback to DB preselected flag.
 */
export function resolveInitialSelection(
    mappings: ProductPageMappingResponse[],
    courseIdsParam?: string
): string[] {
    if (courseIdsParam) {
        const ids = new Set(courseIdsParam.split(',').map((s) => s.trim()).filter(Boolean));
        const matched = mappings
            .filter((m) => ids.has(m.package_session_id) && m.status === 'ACTIVE')
            .map((m) => m.ps_invite_payment_option_id);
        if (matched.length > 0) return matched;
    }
    // Fall back to DB preselected flag
    return mappings
        .filter((m) => m.preselected && m.status === 'ACTIVE')
        .map((m) => m.ps_invite_payment_option_id);
}
