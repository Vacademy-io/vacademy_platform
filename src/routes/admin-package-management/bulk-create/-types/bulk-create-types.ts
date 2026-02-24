export type CourseType = 'COURSE' | 'MEMBERSHIP' | 'PRODUCT' | 'SERVICE';
export type PaymentType = 'FREE' | 'ONE_TIME' | 'SUBSCRIPTION' | 'DONATION';

export interface BatchConfig {
    level_id: string | null;
    session_id: string | null;
    level_name?: string;
    session_name?: string;
    is_parent?: boolean;
    parent_id?: string | null;
    inventory_config?: InventoryConfig;
    payment_config?: PaymentConfig;
}

export interface InventoryConfig {
    max_slots: number | null;
    available_slots?: number | null;
}

export interface PaymentConfig {
    payment_option_id?: string;
    payment_type: PaymentType;
    price?: number;
    elevated_price?: number;
    currency?: string;
    validity_in_days?: number;
    payment_option_name?: string;
    plan_name?: string;
    require_approval?: boolean;
}

export interface SubscriptionDetails {
    billing_period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    price: number;
    currency: string;
    trial_days?: number;
}

export interface BulkCourseItem {
    id: string;
    course_name: string;
    course_type: CourseType;
    tags: string[];
    publish_to_catalogue: boolean;
    batches: BatchConfig[];
    payment_config: PaymentConfig;
    inventory_config?: InventoryConfig;
    thumbnail_file_id?: string | null;
    course_preview_image_media_id?: string | null;
    course_banner_media_id?: string | null;
    course_media_id?: string | null;
    why_learn_html?: string | null;
    who_should_learn_html?: string | null;
    about_the_course_html?: string | null;
    course_html_description?: string | null;
    faculty_user_ids?: string[];
    course_depth?: number;
}

export interface GlobalDefaults {
    enabled: boolean;
    batches: BatchConfig[];
    payment_config: PaymentConfig;
    inventory_config: InventoryConfig;
    course_type: CourseType;
    course_depth: number;
    tags: string[];
    publish_to_catalogue: boolean;
}

// API request course item - payment_config is optional when batches have their own
export interface BulkCreateCourseRequest {
    course_name: string;
    course_type: CourseType;
    tags: string[];
    publish_to_catalogue: boolean;
    batches: BatchConfig[];
    payment_config?: PaymentConfig;
    inventory_config?: InventoryConfig;
    thumbnail_file_id?: string | null;
    course_preview_image_media_id?: string | null;
    course_banner_media_id?: string | null;
    course_media_id?: string | null;
    why_learn_html?: string | null;
    who_should_learn_html?: string | null;
    about_the_course_html?: string | null;
    course_html_description?: string | null;
    faculty_user_ids?: string[];
    course_depth?: number;
}

export interface BulkCreateRequest {
    apply_to_all: GlobalDefaults;
    courses: BulkCreateCourseRequest[];
    dry_run: boolean;
}

export interface BulkCreateResultItem {
    index: number;
    course_name: string;
    status: 'SUCCESS' | 'FAILED';
    course_id?: string;
    package_session_ids?: string[];
    enroll_invite_ids?: string[];
    payment_option_id?: string;
    error_message?: string | null;
}

export interface BulkCreateResponse {
    total_requested: number;
    success_count: number;
    failure_count: number;
    dry_run: boolean;
    results: BulkCreateResultItem[];
}

export interface LevelOption {
    id: string;
    name: string;
}

export interface SessionOption {
    id: string;
    name: string;
}

export interface PaymentOptionItem {
    id: string;
    name: string;
    type: PaymentType;
    price?: number;
    currency?: string;
}

export interface ValidationError {
    courseId: string;
    rowIndex: number;
    field: string;
    message: string;
}

// For CSV import - represents a pre-selected level+session combination
export interface SelectedBatchCombination {
    levelId: string;
    levelName: string;
    sessionId: string;
    sessionName: string;
    // Generated key for CSV column naming (e.g., "class1-2025")
    columnKey: string;
}

// Helper to generate column key from level and session names
export function generateColumnKey(levelName: string, sessionName: string): string {
    const sanitize = (str: string) =>
        str
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
    return `${sanitize(levelName)}-${sanitize(sessionName)}`;
}

// CSV batch column fields
export const BATCH_CSV_FIELDS = ['price', 'payment_type', 'max_slots', 'validity_days'] as const;
export type BatchCsvField = (typeof BATCH_CSV_FIELDS)[number];
