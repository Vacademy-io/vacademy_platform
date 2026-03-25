export type LogType = 'planning' | 'diary_log';
export type IntervalType = 'daily' | 'weekly' | 'monthly' | 'yearly_month' | 'yearly_quarter';
export type EntityType = 'packageSession';
export type PlanningLogStatus = 'ACTIVE' | 'DELETED';

export interface PlanningLog {
    id: string;
    created_by_user_id: string;
    created_by: string;
    log_type: LogType;
    entity: EntityType;
    entity_id: string;
    interval_type: IntervalType;
    interval_type_id: string;
    title: string;
    description?: string;
    content_html: string;
    subject_id: string;
    comma_separated_file_ids?: string;
    is_shared_with_student: boolean;
    status: PlanningLogStatus;
    institute_id: string;
    created_at: string;
    updated_at: string;
}

export interface CreatePlanningLogInput {
    log_type: LogType;
    entity: EntityType;
    entity_id: string;
    interval_type: IntervalType;
    interval_type_id: string;
    title: string;
    description?: string;
    content_html: string;
    subject_id: string;
    comma_separated_file_ids?: string;
    is_shared_with_student: boolean;
}

export interface CreatePlanningLogsRequest {
    logs: CreatePlanningLogInput[];
}

export interface CreatePlanningLogsResponse {
    logs: PlanningLog[];
    message: string;
}

export interface UpdatePlanningLogInput {
    title?: string;
    description?: string;
    content_html?: string;
    comma_separated_file_ids?: string;
    is_shared_with_student?: boolean;
    status?: PlanningLogStatus;
}

export interface PlanningLogFilters {
    interval_types?: IntervalType[];
    interval_type_ids?: string[];
    created_by_user_ids?: string[];
    log_types?: LogType[];
    entity_ids?: string[];
    subject_ids?: string[];
    statuses?: PlanningLogStatus[];
}

export interface ListPlanningLogsRequest extends PlanningLogFilters {
    // Filters are optional
}

export interface ListPlanningLogsResponse {
    content: PlanningLog[];
    pageable: {
        sort: {
            sorted: boolean;
            unsorted: boolean;
            empty: boolean;
        };
        pageNumber: number;
        pageSize: number;
        offset: number;
        paged: boolean;
        unpaged: boolean;
    };
    totalPages: number;
    totalElements: number;
    last: boolean;
    first: boolean;
    size: number;
    number: number;
    sort: {
        sorted: boolean;
        unsorted: boolean;
        empty: boolean;
    };
    numberOfElements: number;
    empty: boolean;
}

// Form state for creating planning logs
export interface PlanningFormData {
    // Section 1
    log_type: LogType;
    title: string;
    description: string;
    packageSessionId: string;
    subject_id: string;
    is_shared_with_student: boolean;
    useCustomTitle?: boolean; // Toggle for custom vs auto-generated title

    // Section 2
    interval_type: IntervalType;
    selectedDate: Date | null;
    interval_type_id: string;
    content_html: string;
    uploadedFileIds: string[];
}
