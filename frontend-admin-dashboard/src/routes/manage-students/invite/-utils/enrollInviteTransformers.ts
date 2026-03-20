import { IndividualInviteLinkDetails } from '@/types/study-library/individual-invite-interface';

/**
 * Helper to extract course and batch details from package_session_to_payment_options
 */
export function extractBatchesFromInviteDetails(
    inviteLinkDetails: IndividualInviteLinkDetails | null,
    getDetailsFromPackageSessionId: (params: { packageSessionId: string }) => {
        id: string;
        level: { id: string; level_name: string };
        package_dto: { id: string; package_name: string };
        session: { id: string; session_name: string };
    } | null
): Array<{
    id: string;
    level: { id: string; level_name: string };
    package_dto: { id: string; package_name: string };
    session: { id: string; session_name: string };
}> {
    if (!inviteLinkDetails?.package_session_to_payment_options) return [];

    const batches = inviteLinkDetails.package_session_to_payment_options
        .map((pso) => {
            const batchDetails = getDetailsFromPackageSessionId({
                packageSessionId: pso.package_session_id,
            });
            return batchDetails;
        })
        .filter((batch): batch is NonNullable<typeof batch> => batch !== null);

    return batches;
}
