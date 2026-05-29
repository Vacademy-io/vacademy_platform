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
    feature_json?: string;
}

export interface ProductPageMappingResponse {
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
    package_id?: string;
    package_name?: string;
    level_name?: string;
    session_name?: string;
    course_preview_image_media_id?: string | null;
    about_the_course_html?: string | null;
    payment_option_type?: string | null;
}

export interface AggregatedCustomField {
    field: {
        id: string;
        type: string;
        type_id: string;
        group_name?: string | null;
        individual_order?: number;
        is_mandatory: boolean;
        status: string;
        custom_field: {
            id: string;
            fieldKey: string;
            fieldName: string;
            fieldType: string;
            isMandatory: boolean;
            formOrder: number;
            config?: string | null;
            commaSeparatedOptions?: string | null;
            defaultValue?: string | null;
        };
    };
    enroll_invite_ids: string[];
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
        channels: string[];
    };
    suggestedCourses?: {
        enabled: boolean;
        heading: string;
        showOn?: 'CART' | 'FORM' | 'BOTH';
    };
    disableBackNavigation?: boolean;
    coupon?: {
        enabled: boolean;
    };
    afterPaymentRedirectUrl?: string;
    showLoginButton?: boolean;
    successPageContent?: string;
}

export interface ProductPageData {
    id: string;
    name: string;
    code: string;
    institute_id: string;
    status: string;
    page_json: string | null;
    settings_json: string | null;
    short_url: string | null;
    mappings: ProductPageMappingResponse[];
    aggregated_custom_fields: AggregatedCustomField[];
    vendor: string | null;
    currency: string | null;
    gtm_container_id: string | null;
}

export interface ProductPageFormSubmitResponse {
    user_id: string;
    abandoned_cart_entry_ids: string[];
    message: string;
}

export interface ProductPageEnrollResponse {
    payment_log_id: string;
    user_id: string;
    user_plan_id?: string | null;
    status: string;
    message: string;
    enrolled_package_session_ids: string[];
    payment_url: string | null;
    order_id: string | null;
    razorpay_key_id: string | null;
    access_token: string | null;
    refresh_token: string | null;
}

export interface CouponValidateResponse {
    coupon_code_id: string;
    applied_coupon_discount_id: string;
    discount_type: 'PERCENTAGE' | 'FIXED';
    discount_value: number;
    max_discount_value: number | null;
    valid: boolean;
    message: string;
}

export type ProductPageStep = 'CATALOG' | 'CART' | 'FORM' | 'PAYMENT' | 'CPO_INSTALLMENTS' | 'SUCCESS';

// ─── page_json types ──────────────────────────────────────────────────────────
export type PageComponentType =
    | 'HeroBanner' | 'FilterBar' | 'CourseGrid' | 'TextBlock'
    | 'ImageBanner' | 'HTML' | 'Header' | 'Footer'
    | 'header' | 'footer' | 'heroSection' | 'productCourseGrid'
    | 'textBlock' | 'htmlBlock' | 'imageBlock' | 'videoEmbed'
    | 'statsHighlights' | 'testimonialSection' | 'faqSection'
    | 'ctaBanner' | 'featureGrid' | 'stepsProcess' | 'marquee';

export interface ComponentStyleLite {
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    marginTop?: string;
    marginBottom?: string;
    backgroundColor?: string;
    borderWidth?: string;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    borderRadius?: string;
    boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    opacity?: number;
    maxWidth?: string;
    minHeight?: string;
    typography?: {
        fontSize?: string;
        fontWeight?: string;
        lineHeight?: string;
        letterSpacing?: string;
        textColor?: string;
        textAlign?: 'left' | 'center' | 'right';
    };
    animation?: {
        entrance?: {
            type: 'none' | 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'fadeInLeft' | 'fadeInRight' | 'scaleUp' | 'slideUp';
            duration?: number;
            delay?: number;
            easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
        };
    };
    visibility?: {
        desktop?: boolean;
        tablet?: boolean;
        mobile?: boolean;
    };
}

export interface PageComponent {
    id: string;
    type: PageComponentType;
    enabled: boolean;
    props: Record<string, unknown>;
    style?: ComponentStyleLite;
}

export interface PageJson {
    globalSettings: { primaryColor: string; logoFileId: string };
    components: PageComponent[];
    suggestions?: Record<string, string[]>;
}

// Per-field value in the registration form
export interface FieldValue {
    id: string;        // custom_field_id
    name: string;      // field_name
    value: string;
    is_mandatory: boolean;
    type: string;      // field_type for render type detection
    comma_separated_options?: string;
    config?: string;
    enroll_invite_ids?: string[]; // which invites own this field — used to filter per-invite on submit
}
