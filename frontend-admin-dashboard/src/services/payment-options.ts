import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    SAVE_PAYMENT_OPTION,
    GET_PAYMENT_OPTIONS,
    MAKE_DEFAULT_PAYMENT_OPTION,
    GET_INVITE_BY_PAYMENT_OPTION_ID_URL,
    UPDATE_INVITE_PAYMENT_OPTION_URL,
    DELETE_PAYMENT_OPTION_URL,
} from '@/constants/urls';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    PaymentPlan,
    PaymentPlanTag,
    PaymentPlanType,
    PaymentPlanApi,
    PaymentOptionApi,
    PaymentPlans,
} from '@/types/payment';
import { DAYS_IN_MONTH } from '@/routes/settings/-constants/terms';
import { InviteLinkDataInterface } from '@/schemas/study-library/invite-links-schema';

export interface SavePaymentOptionRequest {
    name: string;
    status: string;
    source: string;
    source_id: string;
    type: string;
    require_approval: boolean;
    payment_plans: PaymentPlanApi[];
    payment_option_metadata_json: string;
}

export interface GetPaymentOptionsRequest {
    types: string[];
    source: string;
    source_id: string;
    require_approval?: boolean;
    not_require_approval?: boolean;
}

export interface EnrollInvite {
    id: string;
    package_session_id?: string;
    status?: string;
    [key: string]: unknown;
}

export interface UpdatePaymentOptionRequest {
    enroll_invite_id: string;
    update_payment_options: Array<{
        old_package_session_payment_option_id: string;
        new_package_session_payment_option: {
            package_session_id: string;
            id: string;
            payment_option: PaymentOptionApi;
            enroll_invite_id: string;
            status: string;
        };
    }>;
}

// Get institute ID from token
const getInstituteId = (): string => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteIds = Object.keys(tokenData?.authorities || {});

    if (instituteIds.length === 0) {
        throw new Error('No institute ID found in token');
    }

    const firstInstituteId = instituteIds[0];
    if (!firstInstituteId) {
        throw new Error('No institute ID found in token');
    }

    return firstInstituteId;
};

// Save payment option
export const savePaymentOption = async (
    paymentOption: SavePaymentOptionRequest
): Promise<PaymentOptionApi> => {
    try {
        const instituteId = getInstituteId();

        const response = await authenticatedAxiosInstance.post(SAVE_PAYMENT_OPTION, paymentOption, {
            params: { instituteId },
        });

        return response.data;
    } catch (error) {
        console.error('Error saving payment option:', error);
        throw error;
    }
};

// Get payment options
export const getPaymentOptions = async (
    request: GetPaymentOptionsRequest
): Promise<PaymentOptionApi[]> => {
    try {
        const instituteId = getInstituteId();

        const response = await authenticatedAxiosInstance.post(GET_PAYMENT_OPTIONS, request, {
            params: { instituteId },
        });

        return response.data;
    } catch (error) {
        console.error('Error getting payment options:', error);
        throw error;
    }
};

// Helper function to transform local payment plan format to API format
export const transformLocalPlanToApiFormat = (localPlan: PaymentPlan): PaymentPlanApi => {
    let actualPrice = 0;
    let elevatedPrice = 0;
    let validityDays = localPlan.validityDays || 365;

    if (
        localPlan.type === PaymentPlans.SUBSCRIPTION &&
        localPlan.config?.subscription?.customIntervals &&
        localPlan.config.subscription.customIntervals.length > 0
    ) {
        const firstInterval = localPlan.config.subscription.customIntervals[0];
        if (firstInterval) {
            actualPrice = parseFloat(String(firstInterval.price || '0'));
            elevatedPrice = actualPrice;

            // Calculate validity_in_days based on unit and value
            const unit =
                localPlan.config?.unit ||
                localPlan.config?.subscription?.unit ||
                firstInterval.unit ||
                'months';
            const value = firstInterval.value || 1;

            if (unit === 'days') {
                validityDays = value; // Direct conversion
            } else if (unit === 'months') {
                validityDays = value * DAYS_IN_MONTH; // Convert months to days
            } else {
                validityDays = value; // Fallback
            }
        }
    } else if (localPlan.type === PaymentPlans.UPFRONT && localPlan.config?.upfront?.fullPrice) {
        actualPrice = parseFloat(localPlan.config.upfront.fullPrice);
        elevatedPrice = actualPrice;
    } else if (localPlan.type === PaymentPlans.DONATION) {
        actualPrice = parseFloat(localPlan.config?.donation?.minimumAmount || '0');
        elevatedPrice = actualPrice;
    } else if (localPlan.type === PaymentPlans.FREE) {
        actualPrice = 0;
        elevatedPrice = 0;
    }

    return {
        id: undefined,
        name: localPlan.name || '',
        status: 'ACTIVE',
        validity_in_days: validityDays,
        actual_price: actualPrice,
        elevated_price: elevatedPrice,
        currency: localPlan.currency || 'GBP',
        description: localPlan.name || '',
        tag: localPlan.tag || 'free',
        type: localPlan.type.toUpperCase() as PaymentPlanType,
        feature_json: JSON.stringify(localPlan.features || []),
    };
};

// Helper function to transform API payment plan format to local format
export const transformApiPlanToLocalFormat = (apiPlan: PaymentPlanApi): PaymentPlan => {
    const features = JSON.parse(apiPlan.feature_json || '[]');
    let config = {};
    if (apiPlan.payment_option_metadata_json) {
        try {
            const parsed = JSON.parse(apiPlan.payment_option_metadata_json);
            config = parsed.config || {};
        } catch (e) {
            console.warn('Failed to parse payment_option_metadata_json:', e);
        }
    }
    return {
        id: apiPlan.id || '',
        name: apiPlan.name,
        type: apiPlan.type.toUpperCase() as PaymentPlanType,
        tag: apiPlan.tag as PaymentPlanTag,
        currency: apiPlan.currency,
        isDefault: false,
        features: features,
        validityDays: apiPlan.validity_in_days,
        config,
    };
};

export const transformLocalPlanToApiFormatArray = (localPlan: PaymentPlan): PaymentPlanApi[] => {
    if (
        localPlan.type === PaymentPlans.SUBSCRIPTION &&
        localPlan.config?.subscription?.customIntervals
    ) {
        const planDiscounts = localPlan.config?.planDiscounts || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return localPlan.config.subscription.customIntervals.map((interval: any, idx: number) => {
            const originalPrice = parseFloat(String(interval.price || '0'));
            let discountedPrice = originalPrice;
            const discount = planDiscounts[`interval_${idx}`];
            if (discount && discount.type !== 'none' && discount.amount) {
                if (discount.type === 'percentage') {
                    discountedPrice = originalPrice * (1 - parseFloat(discount.amount) / 100);
                } else if (discount.type === 'fixed') {
                    discountedPrice = originalPrice - parseFloat(discount.amount);
                }
                if (discountedPrice < 0) discountedPrice = 0;
            }
            // Calculate validity_in_days based on unit and value
            const unit =
                localPlan.config?.unit ||
                localPlan.config?.subscription?.unit ||
                interval.unit ||
                'months';
            const value = interval.value || 1;
            let validity_in_days: number;

            if (unit === 'days') {
                validity_in_days = value; // Direct conversion
            } else if (unit === 'months') {
                validity_in_days = value * DAYS_IN_MONTH; // Convert months to days (30 days per month)
            } else {
                validity_in_days = value; // Fallback
            }

            return {
                name: interval.title || '',
                status: 'ACTIVE',
                validity_in_days,
                actual_price: discountedPrice,
                elevated_price: originalPrice,
                currency: localPlan.currency || 'GBP',
                description: localPlan.name || '',
                tag: localPlan.tag || 'free',
                type: (localPlan.type?.toUpperCase() as PaymentPlanType) || 'SUBSCRIPTION',
                feature_json: JSON.stringify(interval.features || localPlan.features || []),
            };
        });
    }
    if (localPlan.type === PaymentPlans.UPFRONT && localPlan.config?.upfront?.fullPrice) {
        const originalPrice = parseFloat(localPlan.config.upfront.fullPrice);
        let discountedPrice = originalPrice;
        const discount = localPlan.config?.planDiscounts?.upfront;
        if (discount && discount.type !== 'none' && discount.amount) {
            if (discount.type === 'percentage') {
                discountedPrice = originalPrice * (1 - parseFloat(discount.amount) / 100);
            } else if (discount.type === 'fixed') {
                discountedPrice = originalPrice - parseFloat(discount.amount);
            }
            if (discountedPrice < 0) discountedPrice = 0;
        }
        return [
            {
                name: localPlan.name,
                status: 'ACTIVE',
                validity_in_days: 365,
                actual_price: discountedPrice,
                elevated_price: originalPrice,
                currency: localPlan.currency || 'GBP',
                description: localPlan.name || '',
                tag: localPlan.tag || 'free',
                type: (localPlan.type?.toUpperCase() as PaymentPlanType) || 'UPFRONT',
                feature_json: JSON.stringify(localPlan.features || []),
            },
        ];
    }
    // For other types, just use the existing function
    return [transformLocalPlanToApiFormat(localPlan)];
};

export const makeDefaultPaymentOption = async ({
    source,
    sourceId,
    paymentOptionId,
}: {
    source: string;
    sourceId: string;
    paymentOptionId: string;
}) => {
    try {
        const response = await authenticatedAxiosInstance.post(
            MAKE_DEFAULT_PAYMENT_OPTION,
            {},
            {
                params: {
                    source,
                    sourceId,
                    paymentOptionId,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error making default payment option:', error);
        throw error;
    }
};

// Get invites by payment option ID
export const getInvitesByPaymentOptionId = async (
    paymentOptionIds: string[]
): Promise<InviteLinkDataInterface[]> => {
    try {
        const instituteId = getInstituteId();

        const response = await authenticatedAxiosInstance.post(
            GET_INVITE_BY_PAYMENT_OPTION_ID_URL,
            paymentOptionIds,
            {
                params: { instituteId },
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error getting invites by payment option ID:', error);
        throw error;
    }
};

// Update invite payment option
export const updateInvitePaymentOption = async (
    updateRequests: UpdatePaymentOptionRequest[]
): Promise<unknown> => {
    try {
        const instituteId = getInstituteId();

        const response = await authenticatedAxiosInstance.put(
            UPDATE_INVITE_PAYMENT_OPTION_URL,
            updateRequests,
            {
                params: { instituteId },
            }
        );

        return response.data;
    } catch (error) {
        console.error('Error updating invite payment option:', error);
        throw error;
    }
};

// Delete payment option
export const deletePaymentOption = async (paymentOptionIds: string[]): Promise<unknown> => {
    try {
        const instituteId = getInstituteId();

        const response = await authenticatedAxiosInstance.delete(DELETE_PAYMENT_OPTION_URL, {
            data: paymentOptionIds,
            params: { instituteId },
        });

        return response.data;
    } catch (error) {
        console.error('Error deleting payment option:', error);
        throw error;
    }
};
