export type CatalogueThemePreset =
    | 'default'
    | 'ocean'
    | 'forest'
    | 'sunset'
    | 'midnight'
    | 'rose'
    | 'violet'
    | 'amber'
    | 'slate';

export type CatalogueBorderRadius = 'sharp' | 'rounded' | 'pill';

export interface GlobalSettings {
    courseCatalogeType: {
        enabled: boolean;
        value?: 'Course' | 'Product';
    };
    mode: 'light' | 'dark';
    theme?: {
        /** Named color preset */
        preset?: CatalogueThemePreset;
        /** Custom primary hex color — overrides preset when set */
        primaryColor?: string;
        /** Corner roundness variant */
        borderRadius?: CatalogueBorderRadius;
    };
    fonts?: {
        enabled: boolean;
        family?: string;
    };
    compactness: 'small' | 'medium' | 'large';
    audience: 'children' | 'adults' | 'all';
    leadCollection: {
        enabled: boolean;
        mandatory: boolean;
        inviteLink: string | null;
        formStyle?: {
            type: 'single' | 'multiStep';
            showProgress: boolean;
            progressType: 'bar' | 'dots' | 'steps';
            transition: 'slide' | 'fade';
        };
        fields: any[];
    };
    enrquiry?: {
        enabled: boolean;
        requirePayment: boolean;
    };
    payment: {
        enabled: boolean;
        provider: 'razorpay' | 'stripe' | 'paypal' | 'PHONEPE';
        fields: string[];
    };
    layout?: {
        header?: any;
        footer?: any;
    };
}

export interface Component {
    id: string;
    type: string;
    enabled: boolean;
    showCondition?: {
        field: string;
        value: boolean | string;
    };
    props: Record<string, any>;
}

export interface Page {
    id: string;
    route: string;
    title?: string;
    published?: boolean;
    seo?: {
        metaTitle?: string;
        metaDescription?: string;
        ogImage?: string;
    };
    components: Component[];
}

export interface CatalogueConfig {
    version?: string;
    globalSettings: GlobalSettings;
    introPage?: any;
    pages: Page[];
}

export interface CatalogueTag {
    tagName: string;
    status: 'active' | 'draft';
    lastModified?: string;
    catalogueConfig?: CatalogueConfig;
}
