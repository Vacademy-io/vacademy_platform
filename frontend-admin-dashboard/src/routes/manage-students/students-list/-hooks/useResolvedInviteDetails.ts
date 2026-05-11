import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INVITE_LINKS, GET_SINGLE_INVITE_DETAILS } from '@/constants/urls';
import type {
    EnrollInviteDTO,
    EnrollInviteProjection,
    PaymentOption,
} from '../-types/bulk-assign-types';

interface ResolvedDetails {
    invite: EnrollInviteDTO | null;
    paymentOption: PaymentOption | null;
    complexPaymentOptionId: string | null;
    /** True when no explicit invite id was provided and we resolved the DEFAULT one. */
    resolvedFromDefault: boolean;
}

const fetchInviteDetail = async (
    instituteId: string,
    enrollInviteId: string
): Promise<EnrollInviteDTO> => {
    const url = GET_SINGLE_INVITE_DETAILS
        .replace('{instituteId}', instituteId)
        .replace('{enrollInviteId}', enrollInviteId);
    const response = await authenticatedAxiosInstance.get<EnrollInviteDTO>(url);
    return response.data;
};

const fetchInvitesForPackageSession = async (
    instituteId: string,
    packageSessionId: string
): Promise<EnrollInviteProjection[]> => {
    const params = new URLSearchParams({
        instituteId,
        pageNo: '0',
        pageSize: '50',
    });
    const response = await authenticatedAxiosInstance.post<{
        content: EnrollInviteProjection[];
    }>(`${GET_INVITE_LINKS}?${params}`, {
        package_session_ids: [packageSessionId],
        sort_columns: { created_at: 'desc' },
    });
    return response.data?.content ?? [];
};

/**
 * Resolves the picked invite's PaymentOption for a specific package session.
 *
 * - When `enrollInviteId` is provided: fetches that invite's detail directly.
 * - When it is null (Auto mode): looks up the package session's invite list, picks the
 *   DEFAULT-tagged active invite (falling back to the first ACTIVE), and fetches its detail.
 *   This is what the backend's `DefaultInviteResolver` does, so the panel matches what
 *   the bulk-assign API will actually enroll against.
 */
export const useResolvedInviteDetails = ({
    instituteId,
    packageSessionId,
    enrollInviteId,
}: {
    instituteId: string;
    packageSessionId: string;
    enrollInviteId: string | null | undefined;
}) => {
    return useQuery<ResolvedDetails>({
        queryKey: ['invite-detail-resolution', instituteId, packageSessionId, enrollInviteId],
        queryFn: async () => {
            let resolvedInviteId = enrollInviteId;
            let resolvedFromDefault = false;

            if (!resolvedInviteId) {
                const invites = await fetchInvitesForPackageSession(instituteId, packageSessionId);
                const candidate =
                    invites.find((i) => i.tag === 'DEFAULT' && i.status === 'ACTIVE') ??
                    invites.find((i) => i.status === 'ACTIVE') ??
                    invites[0] ??
                    null;
                if (!candidate) {
                    return {
                        invite: null,
                        paymentOption: null,
                        complexPaymentOptionId: null,
                        resolvedFromDefault: false,
                    };
                }
                resolvedInviteId = candidate.id;
                resolvedFromDefault = true;
            }

            const invite = await fetchInviteDetail(instituteId, resolvedInviteId);
            const pso = invite.package_session_to_payment_options?.find(
                (p) => p.package_session_id === packageSessionId && p.status === 'ACTIVE'
            );
            const paymentOption = pso?.payment_option ?? null;
            return {
                invite,
                paymentOption,
                complexPaymentOptionId: paymentOption?.complex_payment_option_id ?? null,
                resolvedFromDefault,
            };
        },
        enabled: !!instituteId && !!packageSessionId,
        staleTime: 60 * 1000,
    });
};
