import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_USER_PLANS } from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import type { PolicyDetails } from '@/types/membership-expiry';

export interface UserPlanPaymentLog {
    id: string;
    status: string;
    payment_status: string;
    user_id: string;
    vendor: string;
    vendor_id: string;
    date: string;
    currency: string;
    payment_specific_data: string;
    payment_amount: number;
}

export interface ReferralOption {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    referrer_discount_json: string;
    referee_discount_json: string;
    referrer_vesting_days: number;
    tag: string;
    description: string;
    created_at: string;
    updated_at: string;
    setting_json: string;
}

export interface PaymentPlanDTO {
    id: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: string;
    feature_json: string;
    referral_option: ReferralOption;
    referral_option_smapping_status: string;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    tag: string;
    type: string;
    require_approval: boolean;
    unit: string;
    payment_plans: PaymentPlanDTO[];
    payment_option_metadata_json: string;
}

export interface PackageSessionToPaymentOption {
    package_session_id: string;
    id: string;
    payment_option: PaymentOption;
    enroll_invite_id: string;
    status: string;
}

export interface EnrollInviteData {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    invite_code: string;
    status: string;
    institute_id: string;
    vendor: string;
    vendor_id: string;
    currency: string;
    tag: string;
    learner_access_days: number;
    web_page_meta_data_json: string;
    is_bundled: boolean;
    package_session_to_payment_options: PackageSessionToPaymentOption[];
}

export interface UserPlan {
    id: string;
    user_id: string;
    payment_plan_id: string;
    plan_json: string;
    applied_coupon_discount_id: string;
    applied_coupon_discount_json: string;
    enroll_invite_id: string;
    payment_option_id: string;
    payment_option_json: string;
    status: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
    updated_at: string;
    source?: 'USER' | 'SUB_ORG'; // Payment source type
    sub_org_id?: string | null; // Sub-organization ID if source is SUB_ORG
    sub_org_details?: {
        id: string;
        name: string;
        address: string;
    } | null; // Sub-organization details if source is SUB_ORG
    payment_logs: UserPlanPaymentLog[];
    enroll_invite: EnrollInviteData;
    payment_option: PaymentOption;
    payment_plan_dto: PaymentPlanDTO;
    policy_details?: PolicyDetails[];
}

export interface UserPlansResponse {
    content: UserPlan[];
    totalElements?: number;
    totalPages?: number;
    pageable?: {
        paged?: boolean;
        unpaged?: boolean;
        pageNumber?: number;
        pageSize?: number;
        offset?: number;
        sort?: {
            unsorted?: boolean;
            sorted?: boolean;
            empty?: boolean;
        };
    };
    numberOfElements?: number;
    size?: number;
    number?: number;
    sort?: {
        unsorted?: boolean;
        sorted?: boolean;
        empty?: boolean;
    };
    first?: boolean;
    last?: boolean;
    empty?: boolean;
}

export interface GetUserPlansRequest {
    statuses: string[];
    sources?: ('USER' | 'SUB_ORG')[]; // Payment source filter
    sort_columns: Record<string, unknown>;
    user_id: string;
    institute_id: string;
    pageNo?: number;
    pageSize?: number;
}

/**
 * Get user plans with pagination
 * @param pageNo - Page number (1-indexed)
 * @param pageSize - Number of items per page
 * @param statuses - Array of statuses to filter by (e.g., ['ACTIVE'], ['ACTIVE', 'EXPIRED'])
 * @param userId - The user ID to fetch plans for
 * @param instituteId - The institute ID
 * @param sources - Optional array of payment sources to filter by (e.g., ['USER'], ['SUB_ORG'])
 * @returns Promise<UserPlansResponse>
 */
export const getUserPlans = async (
    pageNo: number = 1,
    pageSize: number = 10,
    statuses: string[] = ['ACTIVE'],
    userId?: string,
    instituteId?: string,
    sources?: ('USER' | 'SUB_ORG')[]
): Promise<UserPlansResponse> => {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const tokenData = getTokenDecodedData(accessToken);

        const finalUserId = userId || (tokenData?.user as string | undefined);
        const finalInstituteId =
            instituteId ||
            (() => {
                const instituteIds = Object.keys(tokenData?.authorities || {});
                return instituteIds[0];
            })();

        if (!finalUserId || !finalInstituteId) {
            throw new Error('Missing user_id or institute_id');
        }

        const request: GetUserPlansRequest = {
            statuses,
            sort_columns: {},
            user_id: finalUserId,
            institute_id: finalInstituteId,
            pageNo: pageNo - 1, // Convert to 0-indexed
            pageSize,
        };

        // Add sources filter if provided
        if (sources && sources.length > 0) {
            request.sources = sources;
        }

        const response = await authenticatedAxiosInstance.post(GET_USER_PLANS, request, {
            params: {
                pageNo: pageNo - 1,
                pageSize,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching user plans:', error);
        throw error;
    }
};

/**
 * Get active user plans
 * @param userId - The user ID to fetch plans for
 * @returns Promise<UserPlansResponse>
 */
export const getActivePlans = async (userId: string): Promise<UserPlansResponse> => {
    return getUserPlans(1, 100, ['ACTIVE'], userId);
};

/**
 * Get active and expired user plans
 * @param userId - The user ID to fetch plans for
 * @returns Promise<UserPlansResponse>
 */
export const getActiveAndExpiredPlans = async (userId: string): Promise<UserPlansResponse> => {
    return getUserPlans(1, 100, ['ACTIVE', 'EXPIRED'], userId);
};
