export interface StudentStatsDTO {
    user_type: "NEW_USER" | "RETAINER";
    user_dto: {
        id: string;
        username: string;
        email: string;
        full_name: string;
        mobile_number: string;
    };
    package_session_ids: string[];
    comma_separated_org_roles: string;
    created_at: string;
    start_date: string;
    end_date: string;
}

export interface AllStudentStatsResponse {
    content: StudentStatsDTO[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
    numberOfElements?: number; // Added this as it might be useful and likely present
    number?: number; // Added this as common in Spring Page responses
}

export interface StudentStatsFilter {
    institute_id: string;
    package_session_ids?: string[];
    user_types?: ("NEW_USER" | "RETAINER")[];
    start_date_in_utc: string;
    end_date_in_utc: string;
    search_name?: string;
    sort_columns?: Record<string, "ASC" | "DESC">;
}
