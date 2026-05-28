import { useCallback, useState } from "react";
import {
    validateCouponGeneric,
    couponErrorMessage,
    CouponValidateRequest,
    CouponValidateResponse,
} from "@/services/coupon";

export interface CheckoutCouponState {
    code: string;
    appliedCode: string | null;
    couponCodeId: string | null;
    appliedCouponDiscountId: string | null;
    discount: number;
    error: string | null;
    isApplying: boolean;
}

export interface UseCheckoutCouponOpts {
    /** Closure that builds the validate-request body from the current checkout context. */
    buildRequest: (code: string) => CouponValidateRequest;
    /** Fired after a coupon is successfully applied — surfaces don't need to re-run on remove. */
    onApplied?: (resp: CouponValidateResponse) => void;
    /** Fired when the learner removes the coupon. */
    onCleared?: () => void;
}

const initialState: CheckoutCouponState = {
    code: "",
    appliedCode: null,
    couponCodeId: null,
    appliedCouponDiscountId: null,
    discount: 0,
    error: null,
    isApplying: false,
};

/**
 * Light state machine for "learner enters code → validate → applied or error".
 * Used by all three learner checkout surfaces. The surface owns the price
 * arithmetic (it knows what to subtract from); this hook only manages the
 * coupon's own state + the validate API round-trip.
 */
export const useCheckoutCoupon = ({
    buildRequest,
    onApplied,
    onCleared,
}: UseCheckoutCouponOpts) => {
    const [state, setState] = useState<CheckoutCouponState>(initialState);

    const setCode = useCallback((code: string) => {
        setState((prev) =>
            prev.appliedCode
                ? // editing after apply clears the applied state — learner must re-Apply
                  { ...initialState, code }
                : { ...prev, code, error: null }
        );
    }, []);

    const apply = useCallback(
        async (override?: string) => {
            const code = (override ?? state.code).trim().toUpperCase();
            if (!code) {
                setState((prev) => ({ ...prev, error: "Enter a coupon code first." }));
                return;
            }
            setState((prev) => ({ ...prev, isApplying: true, error: null }));
            try {
                const req = buildRequest(code);
                const resp = await validateCouponGeneric(req);
                if (!resp.valid) {
                    setState((prev) => ({
                        ...prev,
                        isApplying: false,
                        error: couponErrorMessage(resp.message),
                    }));
                    return;
                }
                setState({
                    code,
                    appliedCode: code,
                    couponCodeId: resp.coupon_code_id ?? null,
                    appliedCouponDiscountId: resp.applied_coupon_discount_id ?? null,
                    discount: resp.discount_value ?? 0,
                    error: null,
                    isApplying: false,
                });
                onApplied?.(resp);
            } catch (e) {
                setState((prev) => ({
                    ...prev,
                    isApplying: false,
                    error:
                        (e as { response?: { data?: { message?: string } } })?.response?.data
                            ?.message ??
                        (e as Error)?.message ??
                        "Could not apply coupon. Please try again.",
                }));
            }
        },
        [buildRequest, onApplied, state.code]
    );

    const clear = useCallback(() => {
        setState(initialState);
        onCleared?.();
    }, [onCleared]);

    return { state, setCode, apply, clear };
};
