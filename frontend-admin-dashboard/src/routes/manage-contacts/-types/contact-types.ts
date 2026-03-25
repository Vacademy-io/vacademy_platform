export interface CampaignFilter {
    audience_ids?: string[];
    campaign_name?: string;
    campaign_status?: string;
    campaign_type?: string;
    start_date_from_local?: string;
    start_date_to_local?: string;
}

export interface UserFilter {
    name_search?: string;
    emails?: string[];
    mobile_numbers?: string[];
    regions?: string[];
    genders?: string[];
}

export interface ContactListRequest {
    institute_id: string;
    include_institute_users?: boolean;
    include_audience_respondents?: boolean;
    campaign_filter?: CampaignFilter;
    user_filter?: UserFilter;
    page: number;
    size: number;
    sort_by?: string;
    sort_direction?: 'ASC' | 'DESC';
}

export interface CustomField {
    custom_field_id: string;
    field_key: string;
    field_name: string;
    field_type: string;
    value: string;
}

// Basic User Information
export interface BaseUser {
    id: string; // Changed from user_id to id to match API
    username: string;
    email: string;
    full_name: string;
    address_line?: string;
    city?: string;
    region?: string | null;
    pin_code?: string;
    mobile_number: string;
    date_of_birth?: string;
    gender?: string;
    password?: string | null;
    profile_pic_file_id?: string | null;
    roles?: string[];
    last_login_time?: string;
    root_user?: boolean;
}

// Wrapper structure returned by API
export interface ContactUser {
    user: BaseUser;  // Nested user object
    is_institute_user: boolean;
    is_audience_respondent: boolean;
    custom_fields: CustomField[];
    // Helper property for table compatibility - will map user.id to this
    user_id?: string;
}

export interface ContactListResponse {
    users: ContactUser[];
    total_elements: number;
    total_pages: number;
    current_page: number;
    page_size: number;
    is_last: boolean;
    filtered_audience_ids?: string[];
}
