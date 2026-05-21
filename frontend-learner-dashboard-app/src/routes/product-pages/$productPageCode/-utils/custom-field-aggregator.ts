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
 * Priority:
 *   1. ?courseIds= URL param matched against package_session_id
 *   2. ?courseIds= URL param matched against ps_invite_payment_option_id (admin may pass either)
 *   3. DB preselected flag
 */
export function resolveInitialSelection(
    mappings: ProductPageMappingResponse[],
    courseIdsParam?: string
): string[] {
    if (courseIdsParam) {
        const ids = new Set(courseIdsParam.split(',').map((s) => s.trim()).filter(Boolean));

        // Try package_session_id first (the canonical admin-generated URL format)
        const byPsId = mappings
            .filter((m) => ids.has(m.package_session_id) && m.status === 'ACTIVE')
            .map((m) => m.ps_invite_payment_option_id);
        if (byPsId.length > 0) return byPsId;

        // Also accept ps_invite_payment_option_id directly (URLs copied from admin settings)
        const byOptionId = mappings
            .filter((m) => ids.has(m.ps_invite_payment_option_id) && m.status === 'ACTIVE')
            .map((m) => m.ps_invite_payment_option_id);
        if (byOptionId.length > 0) return byOptionId;
    }

    // Fall back to DB preselected flag
    return mappings
        .filter((m) => m.preselected && m.status === 'ACTIVE')
        .map((m) => m.ps_invite_payment_option_id);
}
