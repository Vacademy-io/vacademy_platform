import type { Component } from '../../-types/editor-types';

export interface PaymentPlan {
    id: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: string;
}

export interface ProductPageInviteMappingResponse {
    id: string;
    ps_invite_payment_option_id: string;
    enroll_invite_id: string;
    package_session_id: string;
    payment_option_id: string;
    payment_plan_id: string;
    payment_plan: PaymentPlan;
    preselected: boolean;
    display_order: number;
    status: string;
    /** Sent by the backend; used to author basket-pricing groups and combos. */
    package_name?: string | null;
    level_name?: string | null;
}

export interface ProductPageAggregatedField {
    field: {
        /** InstituteCustomField PK */
        id: string;
        /** CustomFields PK — used as the customFieldId for add/remove API calls */
        field_id: string;
        /** CustomFieldDTO serializes camelCase (no @JsonNaming on that class) */
        custom_field: {
            id: string;
            fieldKey: string;
            fieldName: string;
            fieldType: string;
            isMandatory: boolean | null;
            formOrder: number | null;
            /** JSON blob: dropdown options, help text, and the verification block. */
            config?: string | null;
        } | null;
        is_mandatory: boolean | null;
        /** Position in this page's form. The mapping's answer, so it beats the
         *  custom field's own institute-wide `formOrder`. Null on fields nobody
         *  has ordered yet — they all tie and keep their arrival order. */
        individual_order?: number | null;
    };
    enroll_invite_ids: string[];
}

export interface ProductPageResponse {
    id: string;
    name: string;
    code: string;
    institute_id: string;
    status: string;
    page_json: string | null;
    settings_json: string | null;
    short_url: string | null;
    mappings: ProductPageInviteMappingResponse[];
    aggregated_custom_fields: ProductPageAggregatedField[];
    vendor: string | null;
    currency: string | null;
    gtm_container_id: string | null;
}

export interface ProductPageInviteMappingRequest {
    ps_invite_payment_option_id: string;
    payment_plan_id: string;
    preselected: boolean;
    display_order: number;
}

export interface ProductPageRequest {
    name: string;
    page_json?: string;
    settings_json?: string;
    status: string;
    mappings: ProductPageInviteMappingRequest[];
}

export interface BasketPricingGroup {
    label: string;
    /** Level names in this group — the basket is split and priced per group. */
    levels: string[];
}

export interface BasketPricingCombo {
    label: string;
    /** Course names that must be selected EXACTLY, within one group. */
    packages: string[];
    price: number;
}

/**
 * Prices the basket as a whole instead of adding up per-course prices, for
 * catalogues that sell "any 3 for X". See BasketPricingCalculator.java — the
 * server recomputes this at checkout and is the authority.
 */
export interface BasketPricingSettings {
    enabled: boolean;
    ladder: {
        /** Price for a basket of 1, 2, 3 … in order. */
        prices: number[];
        /** Added for each course beyond the last listed price. */
        perExtra: number;
    };
    groups?: BasketPricingGroup[];
    /**
     * Where the ladder counts. GROUP (default) prices each class on its own;
     * BASKET counts every subject together.
     */
    ladderScope?: 'GROUP' | 'BASKET';
    /** Count → price, used only when a group's selection is complete. */
    wholeGroupPrices?: Record<string, number>;
    combos?: BasketPricingCombo[];
}

export interface OfferRule {
    /** Stable id — the payment log names which offer paid out. */
    id: string;
    label: string;
    /** Cart total at or above this qualifies. Omit for no amount condition. */
    minAmount?: number;
    /** At least this many courses. Omit for no count condition. */
    minCourses?: number;
    discountType: 'FIXED' | 'PERCENTAGE';
    discountValue: number;
    /** Ceiling for a percentage offer. */
    maxDiscount?: number;
}

/**
 * Predefined offers — no code, applied automatically, everyone sees the same
 * list. Distinct from Coupons, which are codes with their own redemption
 * limits. Only the BEST qualifying rule is applied. Server recomputes it at
 * checkout (OfferCalculator.java).
 */
export interface OffersSettings {
    enabled: boolean;
    rules: OfferRule[];
    heading?: string;
}

export interface ProductPageSettings {
    defaultStep: 'CATALOG' | 'CART' | 'PAYMENT';
    allowCourseDeselection: boolean;
    gtmContainerId?: string;
    tnc: {
        enabled: boolean;
        content: string;
        externalUrl: string;
    };
    invoice: {
        enabled: boolean;
        channels: ('EMAIL' | 'WHATSAPP')[];
    };
    suggestedCourses: {
        enabled: boolean;
        heading: string;
        showOn?: 'CART' | 'FORM' | 'BOTH';
    };
    disableBackNavigation: boolean;
    coupon: {
        enabled: boolean;
    };
    basketPricing?: BasketPricingSettings;
    offers?: OffersSettings;
    afterPaymentRedirectUrl?: string;
    showLoginButton?: boolean;
    successPageContent?: string;
}

export const DEFAULT_PRODUCT_PAGE_SETTINGS: ProductPageSettings = {
    defaultStep: 'CATALOG',
    allowCourseDeselection: true,
    tnc: { enabled: false, content: '', externalUrl: '' },
    invoice: { enabled: true, channels: ['EMAIL'] },
    suggestedCourses: { enabled: false, heading: 'People also buy' },
    disableBackNavigation: false,
    coupon: { enabled: false },
    afterPaymentRedirectUrl: '',
    showLoginButton: true,
    successPageContent: '',
};

export interface ProductPageCouponRequest {
    code: string;
    discount_type: 'PERCENTAGE' | 'FIXED';
    discount_value: number;
    max_discount_value?: number;
    max_uses?: number;
    /** Smallest cart this code may be used on. Omit for no minimum. */
    min_items?: number;
    redeem_start_date?: string;
    redeem_end_date?: string;
}

// ─── page_json — uses catalogue Component type for full reuse ─────────────────

export type { Component as PageComponent };

export interface PageJson {
    globalSettings: {
        primaryColor: string;
        logoFileId: string;
    };
    components: Component[];
    suggestions?: Record<string, string[]>;
}

export const DEFAULT_PAGE_JSON: PageJson = {
    globalSettings: { primaryColor: '#000000', logoFileId: '' },
    components: [
        {
            id: 'header-default',
            type: 'header',
            enabled: true,
            props: { logo: '', title: '', navigation: [], authLinks: [] },
        },
        {
            id: 'herosection-default',
            type: 'heroSection',
            enabled: true,
            props: {
                layout: 'split',
                backgroundColor: '#F8FAFC',
                left: {
                    title: '',
                    description: '',
                    button: { enabled: false, text: 'Enroll Now', action: 'navigate', target: '' },
                },
                right: { image: '', alt: '', imageCollage: [] },
                styles: { padding: '40px', roundedEdges: true, textAlign: 'left' },
            },
        },
        {
            id: 'productcourse-default',
            type: 'productCourseGrid',
            enabled: true,
            props: { columns: 3, showPrice: true, showBadge: true, showFilters: true },
        },
        {
            id: 'footer-default',
            type: 'footer',
            enabled: true,
            props: {
                leftSection: { title: '', text: '', socials: [] },
                rightSection1: { title: 'Quick Links', links: [] },
                bottomNote: '',
            },
        },
    ],
};

// ─── Row state used inside the editor for building/editing mappings ───────────
export interface MappingRow {
    rowId: string;
    inviteId: string;
    inviteName: string;
    psInvitePaymentOptionId: string;
    packageSessionId: string;
    paymentPlanId: string;
    paymentPlanName: string;
    paymentPlanPrice: number;
    currency: string;
    preselected: boolean;
    displayOrder: number;
    /**
     * Carried so the settings tab can offer real level / course pickers.
     * Optional: a row just added from the course picker has not been through the
     * server yet, and these are enrichment for display, never part of the save.
     */
    levelName?: string;
    packageName?: string;
}
