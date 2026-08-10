export interface CourseInformation {
    descriptionRequired: boolean;
    popularTopicsEnabled: boolean;
    learnerOutcomesRequired: boolean;
    aboutCourseRequired: boolean;
    targetAudienceRequired: boolean;
    previewImageRequired: boolean;
    bannerImageEnabled: boolean;
    bannerImageRequired: boolean;
    courseMediaEnabled: boolean;
}

export interface CourseStructure {
    defaultDepth: number;
    fixCourseDepth: boolean;
    enableSessions: boolean;
    enableLevels: boolean;
}

/**
 * Step-by-step filter picker shown to learners the first time they open the
 * course catalogue (Level → Session → Tag, in that fixed order). `steps`
 * controls which of those are asked at all; a single-entry array means the
 * learner sees just that one step. Labels are never stored here — the
 * learner app renders each step's title via Naming Settings
 * (ContentTerms.Level / Session / PopularTag) so a renamed term (e.g.
 * "Level" → "Class") stays in sync everywhere automatically.
 */
export interface CatalogueFilterWizardSettings {
    enabled: boolean;
    steps: Array<'level' | 'session' | 'tag'>;
    /** When false, the learner can skip the wizard and browse unfiltered. */
    mandatory: boolean;
}

export interface CatalogueSettings {
    catalogueMode: 'ask' | 'auto' | 'manual';
    autoPublishToCatalogue: boolean;
    filterWizard?: CatalogueFilterWizardSettings;
}

export interface CourseViewSettings {
    defaultViewMode: 'outline' | 'structure';
    /**
     * Show the author-entered description under a module / chapter title on the
     * content cards — Course Details → Content Structure for admins, and the
     * module / chapter cards in the learner app.
     *
     * Optional + treated as `true` when missing so institutes that saved course
     * settings before this field existed keep showing descriptions.
     */
    showContentDescriptions?: boolean;
}

export interface OutlineSettings {
    defaultState: 'expanded' | 'collapsed';
}

export interface Permissions {
    /**
     * Default course filter for Explore Courses:
     * - 'PARENTS_ONLY'   → only parent batches
     * - 'CHILDREN_ONLY'  → only child batches
     * - null / undefined → no default filter (show all)
     */
    courseFilterType?: 'PARENTS_ONLY' | 'CHILDREN_ONLY' | null;
    allowLearnersToCreateCourses: boolean;
    allowPaymentOptionChange: boolean;
    allowDiscountOptionChange: boolean;
    allowReferralOptionChange: boolean;
}

// Drip Conditions Types
export type DripConditionLevel = 'package' | 'chapter' | 'slide';
export type DripConditionBehavior = 'lock' | 'hide' | 'both';
export type DripConditionRuleType =
    | 'date_based'
    | 'completion_based'
    | 'prerequisite'
    | 'sequential';
export type DripConditionMetric = 'average_of_last_n' | 'average_of_all';

export interface DateBasedParams {
    unlock_date: string; // ISO 8601 format
}

export interface CompletionBasedParams {
    metric: DripConditionMetric;
    count?: number; // Required for average_of_last_n
    threshold: number; // 0-100
}

export interface PrerequisiteParams {
    required_chapters?: string[];
    required_slides?: string[];
    threshold: number; // 0-100
}

export interface SequentialParams {
    requires_previous: boolean;
    threshold: number; // 0-100
}

export type DripConditionRuleParams =
    | DateBasedParams
    | CompletionBasedParams
    | PrerequisiteParams
    | SequentialParams;

export interface DripConditionRule {
    type: DripConditionRuleType;
    params: DripConditionRuleParams;
}

export interface DripConditionConfig {
    target: 'chapter' | 'slide'; // Required for all levels
    behavior: DripConditionBehavior;
    is_enabled: boolean;
    rules: DripConditionRule[];
}

// DripConditionJson is now an array of configs to support multiple targets per level
export type DripConditionJson = DripConditionConfig[];

export interface DripCondition {
    id: string; // Unique identifier for UI management
    level: DripConditionLevel;
    level_id: string; // packageId, chapterId, or slideId
    drip_condition: DripConditionJson;
    enabled: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface DripConditionsSettings {
    enabled: boolean; // Global toggle for drip functionality
    conditions: DripCondition[];
}

export type OfferPriceRoundingMode = 'NONE' | 'CEIL' | 'FLOOR';

export interface OfferPricingSettings {
    enabled: boolean; // Opt-in toggle for the per-course offer-price tool
    rounding?: OfferPriceRoundingMode; // Whole-unit rounding applied to discounted price; default 'NONE'
}

/**
 * Controls which enrollment-side notification toggles are surfaced in the bulk-assign
 * flow. The toggles default to OFF on the server; these flags only decide whether the
 * admin can see them at all in the dialog.
 */
export interface EnrollmentNotificationsSettings {
    showNotifyLearners: boolean;
    showSendCredentials: boolean;
}

/**
 * Status a slide gets when it is copied via slide "Copy to".
 * - KEEP_DRAFT       → copy is DRAFT (default; matches historical behavior)
 * - INHERIT_SOURCE   → copy keeps the source slide's status (PUBLISHED stays PUBLISHED)
 * - ALWAYS_PUBLISHED → copy is always PUBLISHED
 */
export type CopiedSlideStatus = 'KEEP_DRAFT' | 'INHERIT_SOURCE' | 'ALWAYS_PUBLISHED';

export interface CourseSettingsData {
    courseInformation: CourseInformation;
    courseStructure: CourseStructure;
    catalogueSettings: CatalogueSettings;
    courseViewSettings: CourseViewSettings;
    outlineSettings: OutlineSettings;
    permissions: Permissions;
    dripConditions: DripConditionsSettings;
    offerPricing?: OfferPricingSettings;
    enrollmentNotifications?: EnrollmentNotificationsSettings;
    /**
     * Publish behavior for copied slides. Read by admin_core on slide "Copy to".
     * Optional + defaults to KEEP_DRAFT so existing institutes are unaffected.
     */
    copiedSlideStatus?: CopiedSlideStatus;
}

export interface CourseSettings {
    key: string;
    name: string;
    data: CourseSettingsData;
}

// API Request/Response types
export interface CourseSettingsRequest {
    setting_name: string;
    setting_data: CourseSettingsData;
}

export interface CourseSettingsResponse {
    key: string;
    name: string;
    data: CourseSettingsData;
}

// Default settings
export const DEFAULT_COURSE_SETTINGS: CourseSettingsData = {
    courseInformation: {
        descriptionRequired: true,
        popularTopicsEnabled: true,
        learnerOutcomesRequired: true,
        aboutCourseRequired: true,
        targetAudienceRequired: true,
        previewImageRequired: true,
        bannerImageEnabled: true,
        bannerImageRequired: true,
        courseMediaEnabled: true,
    },
    courseStructure: {
        defaultDepth: 3,
        fixCourseDepth: false,
        enableSessions: true,
        enableLevels: true,
    },
    catalogueSettings: {
        catalogueMode: 'ask',
        autoPublishToCatalogue: false,
        filterWizard: {
            enabled: false,
            steps: ['level'],
            mandatory: false,
        },
    },
    courseViewSettings: {
        defaultViewMode: 'outline',
        showContentDescriptions: true,
    },
    outlineSettings: {
        defaultState: 'expanded',
    },
    permissions: {
        courseFilterType: null,
        allowLearnersToCreateCourses: false,
        allowPaymentOptionChange: true,
        allowDiscountOptionChange: true,
        allowReferralOptionChange: true,
    },
    dripConditions: {
        enabled: true,
        conditions: [],
    },
    offerPricing: {
        enabled: false,
        rounding: 'NONE',
    },
    enrollmentNotifications: {
        showNotifyLearners: true,
        showSendCredentials: true,
    },
    copiedSlideStatus: 'KEEP_DRAFT',
};
