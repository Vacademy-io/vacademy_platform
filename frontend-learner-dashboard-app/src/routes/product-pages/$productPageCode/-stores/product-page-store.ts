import { create } from 'zustand';
import type {
    ProductPageData,
    ProductPageStep,
    FieldValue,
} from '../-types/product-page-types';

interface ProductPageStore {
    // Server data
    pageData: ProductPageData | null;
    setPageData: (data: ProductPageData) => void;

    // Navigation
    step: ProductPageStep;
    setStep: (step: ProductPageStep) => void;

    // Course selection — stores ps_invite_payment_option_ids
    selectedPsOptionIds: string[];
    toggleSelection: (psOptionId: string) => void;
    setSelection: (psOptionIds: string[]) => void;

    // Coupon
    couponCode: string;
    couponId: string;
    appliedCouponDiscountId: string;
    discountAmount: number;
    setCouponCode: (code: string) => void;
    applyCoupon: (couponId: string, appliedCouponDiscountId: string, discount: number) => void;
    clearCoupon: () => void;

    // Form / user data (from Step 3 — MultiEnrollForm)
    registrationData: Record<string, FieldValue>;
    setRegistrationData: (data: Record<string, FieldValue>) => void;

    // Post form-submit
    userId: string | null;
    abandonedCartIds: string[];
    setFormSubmitResult: (userId: string, abandonedCartIds: string[]) => void;

    // CPO installment state
    cpoUserPlanId: string | null;
    cpoSelectedSfpIds: string[];
    cpoSelectedTotal: number;
    cpoCustomAmount: number | undefined;
    setCpoEnrollResult: (userPlanId: string) => void;
    setCpoSelection: (sfpIds: string[], total: number) => void;
    setCpoCustomAmount: (amount: number | undefined) => void;

    // UTM params (forwarded from URL)
    utmParams: Record<string, string>;
    setUtmParams: (params: Record<string, string>) => void;

    // Computed
    totalPrice: () => number;
    finalPrice: () => number;

    reset: () => void;
}

const initialState = {
    pageData: null,
    step: 'CATALOG' as ProductPageStep,
    selectedPsOptionIds: [],
    couponCode: '',
    couponId: '',
    appliedCouponDiscountId: '',
    discountAmount: 0,
    registrationData: {},
    userId: null,
    abandonedCartIds: [],
    utmParams: {},
    cpoUserPlanId: null,
    cpoSelectedSfpIds: [],
    cpoSelectedTotal: 0,
    cpoCustomAmount: undefined,
};

export const useProductPageStore = create<ProductPageStore>((set, get) => ({
    ...initialState,

    setPageData: (data) => set({ pageData: data }),

    setStep: (step) => set({ step }),

    toggleSelection: (psOptionId) => {
        const { selectedPsOptionIds, pageData } = get();
        const settings = pageData?.settings_json
            ? (() => { try { return JSON.parse(pageData.settings_json); } catch { return {}; } })()
            : {};
        const allowDeselect = settings.allowCourseDeselection !== false;

        if (selectedPsOptionIds.includes(psOptionId)) {
            if (allowDeselect) {
                set({ selectedPsOptionIds: selectedPsOptionIds.filter((id) => id !== psOptionId) });
            }
        } else {
            set({ selectedPsOptionIds: [...selectedPsOptionIds, psOptionId] });
        }
    },

    setSelection: (psOptionIds) => set({ selectedPsOptionIds: psOptionIds }),

    setCouponCode: (code) => set({ couponCode: code }),

    applyCoupon: (couponId, appliedCouponDiscountId, discount) =>
        set({ couponId, appliedCouponDiscountId, discountAmount: discount }),

    clearCoupon: () =>
        set({ couponId: '', appliedCouponDiscountId: '', discountAmount: 0, couponCode: '' }),

    setRegistrationData: (data) => set({ registrationData: data }),

    setFormSubmitResult: (userId, abandonedCartIds) => set({ userId, abandonedCartIds }),

    setCpoEnrollResult: (userPlanId) => set({ cpoUserPlanId: userPlanId }),

    setCpoSelection: (sfpIds, total) => set({ cpoSelectedSfpIds: sfpIds, cpoSelectedTotal: total }),

    setCpoCustomAmount: (amount) => set({ cpoCustomAmount: amount }),

    setUtmParams: (params) => set({ utmParams: params }),

    totalPrice: () => {
        const { pageData, selectedPsOptionIds } = get();
        if (!pageData) return 0;
        return pageData.mappings
            .filter((m) => selectedPsOptionIds.includes(m.ps_invite_payment_option_id))
            .reduce((sum, m) => sum + (m.payment_plan?.actual_price ?? 0), 0);
    },

    finalPrice: () => {
        const { discountAmount } = get();
        return Math.max(0, get().totalPrice() - discountAmount);
    },

    reset: () => set(initialState),
}));
