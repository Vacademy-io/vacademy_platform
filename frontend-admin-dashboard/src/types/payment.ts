// Payment plan types
export type PaymentPlanType = 'SUBSCRIPTION' | 'ONE_TIME' | 'DONATION' | 'FREE';
export type PaymentPlanTag = 'DEFAULT' | 'free' | null;

export interface PaymentPlanApi {
    id?: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: PaymentPlanTag;
    type: PaymentPlanType;
    feature_json: string;
    payment_option_metadata_json?: string;
}

export interface PaymentOptionApi {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    tag: PaymentPlanTag;
    type: PaymentPlanType;
    require_approval: boolean;
    payment_plans: PaymentPlanApi[];
    payment_option_metadata_json: string;
}

export interface PaymentPlan {
    id: string;
    name: string;
    type: PaymentPlanType;
    tag: PaymentPlanTag;
    currency: string;
    isDefault: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
    features?: string[];
    validityDays?: number;
    requireApproval?: boolean;
}

export enum PaymentPlans {
    FREE = 'FREE',
    DONATION = 'DONATION',
    SUBSCRIPTION = 'SUBSCRIPTION',
    UPFRONT = 'ONE_TIME',
}
