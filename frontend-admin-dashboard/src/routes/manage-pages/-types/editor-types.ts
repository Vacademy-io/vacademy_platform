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
    /** Site-wide custom CSS, injected into every imported HTML page's shadow
     *  root ahead of that page's own styles.
     *
     *  A pasted multi-page bundle shares one stylesheet — the real one we
     *  tested was 64KB across 36 pages. Stored per page that is ~2MB of
     *  duplicated CSS inside a single catalogue_json; stored here it is one
     *  copy. It cannot simply live in <head>: shadow roots inherit custom
     *  properties but NOT stylesheets, so it has to be pushed into each root. */
    customCss?: string;
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
        /** Page atmosphere: canvas treatment + strength (data-catalogue-atmosphere) */
        atmosphere?: {
            canvas: 'flat' | 'soft' | 'mesh' | 'aurora';
            intensity?: 'subtle' | 'medium' | 'bold';
        };
    };
    fonts?: {
        enabled: boolean;
        /** Body font (CSS stack). */
        family?: string;
        /** Optional heading font (CSS stack) — a serif/display face over the
         *  sans body. Unset ⇒ headings use the body font. */
        headingFamily?: string;
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
    /** Motion personality — scales entrance durations/easing site-wide */
    motion?: {
        personality: 'none' | 'calm' | 'balanced' | 'dynamic';
    };
}

// Style schema now lives in the SHARED catalogue style engine (byte-synced
// with the learner renderer via scripts/check-style-engine-sync.mjs) so the
// editor and the live site can never disagree about what a style means.
export type {
    GradientStop,
    GradientConfig,
    TypographyStyle,
    AnimationEntrance,
    AnimationConfig,
    ComponentStyle,
    SectionLayoutStyle,
    SectionWidth,
    GlassConfig,
    GlowConfig,
    BorderGradientConfig,
    BackgroundLayer,
    OverlayPreset,
} from '../-utils/style-engine';
export type { OrnamentConfig, DividerConfig, SectionDividers } from '../-utils/catalogue-decorations';
import type { ComponentStyle } from '../-utils/style-engine';

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
