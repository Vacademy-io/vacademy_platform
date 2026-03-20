// Challenge Analytics Dashboard Types

// Date Range type used across all analytics responses
export interface DateRange {
    start_date: string;
    end_date: string;
}

// ============================================
// Feature 1: Center Interaction Heatmap Types
// ============================================

export interface CenterHeatmapItem {
    audience_id: string;
    campaign_name: string;
    campaign_type: string;
    description?: string;
    campaign_objective?: string;
    status: string;
    start_date: string;
    end_date: string;
    unique_users: number;
    total_responses: number;
    avg_responses_per_user: number;
}

export interface CenterHeatmapResponse {
    total_campaigns: number;
    total_unique_users: number;
    total_responses: number;
    center_heatmap: CenterHeatmapItem[];
}

export interface CenterHeatmapRequest {
    institute_id: string;
    start_date: string;
    end_date: string;
    status?: string;
}

// ============================================
// Feature 2, 3, 4: Daily Participation Types
// ============================================

export interface TemplateInfo {
    template_identifier: string;
    sub_template_label?: string;
    unique_users: number;
    total_messages: number;
}

export interface MessageMetrics {
    unique_users: number;
    total_messages: number;
    templates: TemplateInfo[];
}

export interface DayParticipation {
    day_number: number;
    day_label: string;
    outgoing: MessageMetrics;
    incoming: MessageMetrics;
    response_rate: number;
}

export interface ParticipationSummary {
    total_unique_users_reached: number;
    total_unique_users_responded: number;
    overall_response_rate: number;
}

export interface DailyParticipationData {
    total_days: number;
    total_messages_sent: number;
    total_messages_received: number;
    days: DayParticipation[];
    summary: ParticipationSummary;
}

export interface DailyParticipationResponse {
    institute_id: string;
    date_range: DateRange;
    daily_participation: DailyParticipationData;
}

export interface DailyParticipationRequest {
    institute_id: string;
    start_date: string;
    end_date: string;
}

// ============================================
// Feature 7: Engagement Leaderboard Types
// ============================================

export interface EngagementMetrics {
    total_messages: number;
    outgoing_messages: number;
    incoming_messages: number;
    engagement_score: number;
}

export interface UserInfo {
    id: string;
    username?: string;
    full_name: string;
    email: string;
    mobile_number?: string;
    address_line?: string | null;
    city?: string | null;
    region?: string | null;
    pin_code?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    profile_pic_file_id?: string | null;
}

export interface UserDetails {
    user: UserInfo;
    custom_fields: Record<string, string>;
}

export interface LeaderboardEntry {
    rank: number;
    phone_number: string;
    engagement_metrics: EngagementMetrics;
    user_details: UserDetails | null;
}

export interface PaginationInfo {
    current_page: number;
    page_size: number;
    total_users: number;
    total_pages: number;
}

export interface LeaderboardResponse {
    institute_id: string;
    date_range: DateRange;
    pagination: PaginationInfo;
    leaderboard: LeaderboardEntry[];
}

export interface LeaderboardRequest {
    institute_id: string;
    start_date: string;
    end_date: string;
    page: number;
    page_size: number;
}

// ============================================
// Feature 8: Completion Cohort Types
// ============================================

export interface CompletedUser {
    phone_number: string;
    completion_date: string;
    user_details: UserDetails;
}

export interface CompletionSummary {
    total_completed_users: number;
    completion_template_identifiers: string[];
    date_range: DateRange;
}

export interface CompletionCohortResponse {
    institute_id: string;
    completion_summary: CompletionSummary;
    pagination: PaginationInfo;
    completed_users: CompletedUser[];
}

export interface CompletionCohortRequest {
    institute_id: string;
    completion_template_identifiers: string[];
    start_date: string;
    end_date: string;
    page: number;
    page_size: number;
}

// ============================================
// Outgoing Templates Types (Helper API)
// ============================================

export interface TemplateItem {
    template_identifier: string;
}

export interface DayTemplates {
    day_number: number;
    day_label: string;
    templates: TemplateItem[];
}

export interface OutgoingTemplatesResponse {
    institute_id: string;
    date_range: DateRange | null;
    days: DayTemplates[];
}

// ============================================
// Feature 6: Referral Acquisition Types
// ============================================

export interface CampaignItem {
    id: string;
    institute_id: string;
    campaign_name: string;
    campaign_type: string;
    campaign_objective?: string;
    status: string;
    total_users?: number;
    start_date_local?: string;
    end_date_local?: string;
    created_at: string;
}

export interface CampaignListResponse {
    content: CampaignItem[];
    page_number: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
}

export interface CampaignFilterRequest {
    institute_id: string;
    status?: string;
    campaign_type?: string;
    page?: number;
    size?: number;
}

// ============================================
// Referral Leads Types
// ============================================

export interface ReferralLeadUser {
    id: string;
    username?: string;
    email: string;
    full_name: string;
    mobile_number?: string;
    address_line?: string | null;
    city?: string | null;
    region?: string | null;
    pin_code?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    profile_pic_file_id?: string | null;
}

export interface ReferralLead {
    response_id: string;
    audience_id: string;
    campaign_name?: string | null;
    user_id: string;
    source_type: string;
    source_id: string;
    submitted_at_local: string;
    user: ReferralLeadUser;
    custom_field_values: Record<string, string>;
    custom_field_metadata?: Record<string, unknown> | null;
}

export interface ReferralLeadsResponse {
    content: ReferralLead[];
    totalPages: number;
    totalElements: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface ReferralLeadsRequest {
    audience_id: string;
    submitted_from_local: string;
    submitted_to_local: string;
    page: number;
    size: number;
}

// ============================================
// Dashboard State Types
// ============================================

export interface AnalyticsDashboardState {
    selectedInstitute: string;
    dateRange: DateRange;
    selectedTemplates: string[];
    loading: {
        heatmap: boolean;
        participation: boolean;
        leaderboard: boolean;
        cohort: boolean;
        campaigns: boolean;
        templates: boolean;
    };
    error: {
        heatmap: string | null;
        participation: string | null;
        leaderboard: string | null;
        cohort: string | null;
        campaigns: string | null;
        templates: string | null;
    };
}

// ============================================
// Churn Analysis Types
// ============================================

export interface ChurnAlert {
    type: 'critical' | 'warning' | 'urgent';
    message: string;
    action: string;
    day_number: number;
    day_label: string;
}
