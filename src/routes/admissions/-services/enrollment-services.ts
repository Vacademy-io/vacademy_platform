import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_DEFAULT_PAYMENT_OPTION, SCHOOL_ENROLL } from '@/constants/urls';

export interface SchoolEnrollPayload {
    user: {
        id: string;
        username?: string;
        email?: string;
        full_name?: string;
        address_line?: string;
        city?: string;
        region?: string;
        pin_code?: string;
        mobile_number?: string;
        date_of_birth?: string;
        gender?: string;
        password?: string;
        profile_pic_file_id?: string;
        roles?: string[];
        last_login_time?: string;
        is_parent?: boolean;
        linked_parent_id?: string;
        root_user?: boolean;
    };
    institute_id: string;
    package_session_id: string;
    cpo_id: string;
    payment_option_id?: string | null;
    enroll_invite_id?: string | null;
    school_payment: {
        payment_mode: string;
        amount: number;
        manual_payment: {
            file_id: string;
            transaction_id: string;
        };
    };
    start_date?: string;
}

export const schoolEnroll = async (payload: SchoolEnrollPayload) => {
    const response = await authenticatedAxiosInstance.post(SCHOOL_ENROLL, payload);
    return response.data;
};

export const fetchDefaultPaymentOptionId = async (instituteId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_DEFAULT_PAYMENT_OPTION, {
        params: {
            source: 'INSTITUTE',
            sourceId: instituteId,
        },
    });
    const data = response.data as {
        id?: string;
        payment_option_id?: string;
        paymentOptionId?: string;
        payment_option?: { id?: string };
    };
    return (
        data?.id ??
        data?.payment_option_id ??
        data?.paymentOptionId ??
        data?.payment_option?.id ??
        null
    );
};
