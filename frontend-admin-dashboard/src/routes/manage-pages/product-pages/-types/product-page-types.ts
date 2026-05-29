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
        } | null;
        is_mandatory: boolean | null;
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
}
