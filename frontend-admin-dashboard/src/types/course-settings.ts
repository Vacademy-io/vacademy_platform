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

export interface CatalogueSettings {
    catalogueMode: 'ask' | 'auto' | 'manual';
    autoPublishToCatalogue: boolean;
}

export interface CourseViewSettings {
    defaultViewMode: 'outline' | 'structure';
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

export interface CourseSettingsData {
    courseInformation: CourseInformation;
    courseStructure: CourseStructure;
    catalogueSettings: CatalogueSettings;
    courseViewSettings: CourseViewSettings;
    outlineSettings: OutlineSettings;
    permissions: Permissions;
    dripConditions: DripConditionsSettings;
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
    },
    courseViewSettings: {
        defaultViewMode: 'outline',
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
        enabled: false,
        conditions: [],
    },
};
