import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = `${BASE_URL}/admin-core-service/credits/packs`;

// ─── Types (mirror Java DTOs in features/credits/dto/) ────────────────

export interface CreditPack {
    pack_id: string;
    code: string;
    name: string;
    credits: number;
    currency: 'INR' | 'USD';
    base_amount_minor: number;
    tax_amount_minor: number;
    total_amount_minor: number;
    tax_rate_bps: number;
    display_price_major: string;
    display_base_major: string;
    display_tax_major: string;
    hsn_sac_code: string;
    badge?: string | null;
    is_export: boolean;
}

export interface CreditPackPurchaseResponse {
    platform_payment_id: string;
    razorpay_order_id: string;
    razorpay_key_id: string;
    amount_minor: number;
    currency: 'INR' | 'USD';
    pack_code: string;
    display_price_major: string;
}

export interface CreditPackOrderStatus {
    platform_payment_id: string;
    status: 'INITIATED' | 'SUCCESS' | 'FAILED';
    payment_status:
        | 'PAYMENT_PENDING'
        | 'PAID'
        | 'FAILED'
        | 'REFUNDED'
        | 'PARTIALLY_REFUNDED';
    credits_granted: number | null;
    invoice_url: string | null;
}

// ─── Fetchers ────────────────────────────────────────────────────────

export async function fetchCreditPacks(instituteId: string): Promise<CreditPack[]> {
    const response = await authenticatedAxiosInstance.get<CreditPack[]>(
        `${API_BASE}?instituteId=${encodeURIComponent(instituteId)}`,
    );
    return response.data;
}

export async function purchaseCreditPack(
    instituteId: string,
    packId: string,
): Promise<CreditPackPurchaseResponse> {
    // Snake_case body — matches the BE DTO's @JsonNaming(SnakeCaseStrategy)
    // and the codebase-wide convention used by PaymentInitiationRequestDTO etc.
    const response = await authenticatedAxiosInstance.post<CreditPackPurchaseResponse>(
        `${API_BASE}/purchase`,
        { institute_id: instituteId, pack_id: packId },
    );
    return response.data;
}

export async function fetchOrderStatus(platformPaymentId: string): Promise<CreditPackOrderStatus> {
    const response = await authenticatedAxiosInstance.get<CreditPackOrderStatus>(
        `${API_BASE}/orders/${encodeURIComponent(platformPaymentId)}/status`,
    );
    return response.data;
}

// ─── React Query hooks ───────────────────────────────────────────────

export const useCreditPacksQuery = (instituteId: string | null | undefined, enabled = true) => {
    return useQuery({
        queryKey: ['GET_CREDIT_PACKS', instituteId],
        queryFn: () => fetchCreditPacks(instituteId!),
        enabled: !!instituteId && enabled,
        staleTime: 5 * 60_000, // packs change rarely
        retry: false,
    });
};

export const usePurchaseCreditPackMutation = () => {
    return useMutation({
        mutationFn: ({ instituteId, packId }: { instituteId: string; packId: string }) =>
            purchaseCreditPack(instituteId, packId),
    });
};

export const useOrderStatusQuery = (
    platformPaymentId: string | null,
    pollMs: number | false,
    enabled = true,
) => {
    return useQuery({
        queryKey: ['GET_CREDIT_PACK_ORDER_STATUS', platformPaymentId],
        queryFn: () => fetchOrderStatus(platformPaymentId!),
        enabled: !!platformPaymentId && enabled,
        refetchInterval: pollMs,
        retry: false,
    });
};

/**
 * Invalidate the AI credits panel queries so the balance refreshes after a
 * confirmed purchase. Call after order status flips to PAID.
 */
export const useInvalidateCreditQueriesOnPaid = () => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['GET_AI_CREDITS'] });
        queryClient.invalidateQueries({ queryKey: ['GET_AI_TRANSACTIONS'] });
        queryClient.invalidateQueries({ queryKey: ['GET_AI_USAGE_FORECAST'] });
        queryClient.invalidateQueries({ queryKey: ['GET_AI_USAGE_ANALYTICS'] });
    };
};

// ─── Razorpay Checkout loader ────────────────────────────────────────

const RZP_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let rzpLoaderPromise: Promise<void> | null = null;

/**
 * Lazily inject Razorpay's checkout.js. Idempotent — a second call returns the
 * same promise so the script tag is added at most once.
 */
export function loadRazorpayScript(): Promise<void> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('Razorpay can only load in the browser'));
    }
    // Already loaded?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) return Promise.resolve();

    if (rzpLoaderPromise) return rzpLoaderPromise;

    rzpLoaderPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = RZP_SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            rzpLoaderPromise = null;
            reject(new Error('Failed to load Razorpay checkout.js'));
        };
        document.head.appendChild(script);
    });
    return rzpLoaderPromise;
}

export interface RazorpayOpenOptions {
    key: string;
    order_id: string;
    amount: number;
    currency: string;
    name: string;
    description?: string;
    prefill?: {
        email?: string;
        contact?: string;
        name?: string;
    };
    notes?: Record<string, string>;
    theme?: { color?: string };
    handler: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
    }) => void;
    modal?: {
        ondismiss?: () => void;
    };
}

/**
 * Open Razorpay Checkout. Caller must {@link loadRazorpayScript} first.
 */
export function openRazorpayCheckout(options: RazorpayOpenOptions): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Razorpay = (window as any).Razorpay;
    if (!Razorpay) {
        throw new Error('Razorpay not loaded — call loadRazorpayScript first');
    }
    new Razorpay(options).open();
}
