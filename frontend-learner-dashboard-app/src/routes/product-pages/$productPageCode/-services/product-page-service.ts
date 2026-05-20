import axios from 'axios';
import {
    GET_PRODUCT_PAGE_BY_CODE,
    VALIDATE_PRODUCT_PAGE_COUPON,
    PRODUCT_PAGE_FORM_SUBMIT,
    PRODUCT_PAGE_ENROLL,
} from '@/constants/urls';
import type {
    ProductPageData,
    ProductPageFormSubmitResponse,
    ProductPageEnrollResponse,
    CouponValidateResponse,
    FieldValue,
} from '../-types/product-page-types';

export const getProductPageByCode = async (
    code: string,
    instituteId: string
): Promise<ProductPageData> => {
    const response = await axios.get<ProductPageData>(GET_PRODUCT_PAGE_BY_CODE(code, instituteId));
    return response.data;
};

export const handleGetProductPage = (code: string, instituteId: string) => ({
    queryKey: ['PRODUCT_PAGE_BY_CODE', code, instituteId],
    queryFn: () => getProductPageByCode(code, instituteId),
    staleTime: 5 * 60 * 1000,
    enabled: !!code && !!instituteId,
});

export const validateCoupon = async (
    coursePageCode: string,
    couponCode: string,
    totalAmount: number
): Promise<CouponValidateResponse> => {
    const response = await axios.post<CouponValidateResponse>(
        VALIDATE_PRODUCT_PAGE_COUPON,
        null,
        {
            params: { coursePageCode, couponCode, totalAmount },
        }
    );
    return response.data;
};

interface FormSubmitPayload {
    coursePageCode: string;
    instituteId: string;
    selectedPsInvitePaymentOptionIds: string[];
    registrationData: Record<string, FieldValue>;
}

function matchesEmail(v: FieldValue) {
    const t = v.type?.toLowerCase() ?? '';
    const n = v.name?.toLowerCase() ?? '';
    return t.includes('email') || n.includes('email');
}

function matchesPhone(v: FieldValue) {
    const t = v.type?.toLowerCase() ?? '';
    const n = v.name?.toLowerCase() ?? '';
    return t.includes('phone') || n.includes('phone') || n.includes('mobile');
}

function matchesName(v: FieldValue) {
    const n = v.name?.toLowerCase() ?? '';
    return n.includes('name') && !matchesEmail(v) && !matchesPhone(v);
}

export const submitProductPageForm = async (
    payload: FormSubmitPayload
): Promise<ProductPageFormSubmitResponse> => {
    const { coursePageCode, instituteId, selectedPsInvitePaymentOptionIds, registrationData } = payload;

    const values = Object.values(registrationData);
    const email = values.find(matchesEmail)?.value ?? '';
    const phone = values.find(matchesPhone)?.value ?? '';
    const name = values.find(matchesName)?.value ?? '';

    const customFieldValues = values.map((f) => ({
        custom_field_id: f.id,
        value: f.value,
        enroll_invite_ids: f.enroll_invite_ids ?? [],
    }));

    const response = await axios.post<ProductPageFormSubmitResponse>(PRODUCT_PAGE_FORM_SUBMIT, {
        product_page_code: coursePageCode,
        institute_id: instituteId,
        selected_ps_invite_payment_option_ids: selectedPsInvitePaymentOptionIds,
        user_details: {
            email,
            username: email,
            mobile_number: phone,
            full_name: name,
            address_line: '',
            region: '',
            city: '',
            pin_code: '',
            date_of_birth: new Date().toISOString().split('T')[0],
            gender: '',
        },
        learner_extra_details: {},
        custom_field_values: customFieldValues,
    });
    return response.data;
};

interface EnrollPayload {
    coursePageCode: string;
    instituteId: string;
    userId: string;
    selectedMappings: Array<{
        ps_invite_payment_option_id: string;
        payment_plan_id: string;
        amount: number;
    }>;
    couponCode?: string;
    registrationData: Record<string, FieldValue>;
    paymentInitiationRequest: Record<string, unknown>;
}

export const enrollForProductPage = async (
    payload: EnrollPayload
): Promise<ProductPageEnrollResponse> => {
    const { registrationData } = payload;
    const values = Object.values(registrationData);
    const email = values.find(matchesEmail)?.value ?? '';
    const phone = values.find(matchesPhone)?.value ?? '';
    const name = values.find(matchesName)?.value ?? '';

    const customFieldValues = values.map((f) => ({
        custom_field_id: f.id,
        value: f.value,
        enroll_invite_ids: f.enroll_invite_ids ?? [],
    }));

    const response = await axios.post<ProductPageEnrollResponse>(PRODUCT_PAGE_ENROLL, {
        product_page_code: payload.coursePageCode,
        institute_id: payload.instituteId,
        user_id: payload.userId,
        selected_mappings: payload.selectedMappings.map((m) => ({
            ps_invite_payment_option_id: m.ps_invite_payment_option_id,
            payment_plan_id: m.payment_plan_id,
            amount: m.amount,
        })),
        coupon_code: payload.couponCode || null,
        user: {
            email,
            username: email,
            mobile_number: phone,
            full_name: name,
        },
        learner_extra_details: {},
        refer_request: null,
        custom_field_values: customFieldValues,
        payment_initiation_request: payload.paymentInitiationRequest,
    });
    return response.data;
};
