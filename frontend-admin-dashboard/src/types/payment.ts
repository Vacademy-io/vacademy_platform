// Payment plan types
export type PaymentPlanType = 'SUBSCRIPTION' | 'ONE_TIME' | 'DONATION' | 'FREE' | 'CPO';
export type PaymentPlanTag = 'DEFAULT' | 'free' | null;

export interface PaymentPlanApi {
    id?: string;
    name: string;
    status: string;
    /**
     * Days of course access the plan grants, counted from enrollment.
     * null = unlimited — the backend leaves expiry_date unset for these.
     */
    validity_in_days: number | null;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: PaymentPlanTag;
    type: PaymentPlanType;
    feature_json: string;
    payment_option_metadata_json?: string;
    /**
     * Members already on another plan may switch TO this one. Only honoured when the
     * parent option's `plan_change_allowed` is also true.
     */
    plan_change_allowed?: boolean;
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
    /**
     * Master switch for plan change: members on another option of the same package
     * session may switch INTO this option. A plan is offered as a switch target only when
     * both this and the plan's own `plan_change_allowed` are true.
     */
    plan_change_allowed?: boolean;
    /** Populated when type='CPO'. Points at the underlying ComplexPaymentOption row. */
    complex_payment_option_id?: string;
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
    /** Option-level master switch for "members can switch into this option". */
    planChangeAllowed?: boolean;
}

export enum PaymentPlans {
    FREE = 'FREE',
    DONATION = 'DONATION',
    SUBSCRIPTION = 'SUBSCRIPTION',
    UPFRONT = 'ONE_TIME',
    CPO = 'CPO',
}
