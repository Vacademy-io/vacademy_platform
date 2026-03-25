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
        /** Heading size scale */
        headingScale?: 'compact' | 'default' | 'large' | 'display';
        /** Body font size override */
        bodyFontSize?: string;
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
    /** Sticky header — sticks to top on scroll */
    stickyHeader?: boolean;
    /** Show back-to-top floating button */
    backToTop?: boolean;
}

export interface GradientStop {
    color: string;
    position: number;
}

export interface GradientConfig {
    type: 'linear' | 'radial';
    angle?: number;
    stops: GradientStop[];
}

export interface TypographyStyle {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: '400' | '500' | '600' | '700' | '800';
    lineHeight?: string;
    letterSpacing?: string;
    textColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface AnimationEntrance {
    type: 'none' | 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'fadeInLeft' | 'fadeInRight' | 'scaleUp' | 'slideUp';
    duration?: number;
    delay?: number;
    easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface AnimationConfig {
    entrance?: AnimationEntrance;
    hover?: { type: 'none' | 'lift' | 'glow' | 'scale' | 'brighten' };
    scroll?: { parallax?: boolean; parallaxSpeed?: number };
}

export interface ComponentStyle {
    // Spacing
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    marginTop?: string;
    marginBottom?: string;
    // Background
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundSize?: 'cover' | 'contain' | 'auto';
    backgroundPosition?: string;
    backgroundOverlay?: string;
    gradient?: GradientConfig;
    // Border
    borderWidth?: string;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
    borderRadius?: string;
    // Shadow & Effects
    boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    opacity?: number;
    maxWidth?: string;
    minHeight?: string;
    customClass?: string;
    // Typography
    typography?: TypographyStyle;
    // Animation
    animation?: AnimationConfig;
    // Responsive overrides
    responsive?: {
        tablet?: Partial<ComponentStyle>;
        mobile?: Partial<ComponentStyle>;
    };
    visibility?: {
        desktop?: boolean;
        tablet?: boolean;
        mobile?: boolean;
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
    style?: ComponentStyle;
    /** Anchor ID for in-page linking (e.g. "pricing" → #pricing) */
    anchorId?: string;
}

export interface Page {
    id: string;
    route: string;
    title?: string;
    published?: boolean;
    /** Page-level background color override */
    backgroundColor?: string;
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
