// Mentorship DTOs — snake_case to mirror the admin-core-service API.

export interface MentorDTO {
    id: string;
    institute_id: string;
    user_id: string;
    display_name?: string | null;
    title?: string | null;
    profile_image_file_id?: string | null;
    bio?: string | null;
    booking_page_id?: string | null;
    booking_page_slug?: string | null;
    google_account_id?: string | null;
    google_connected?: boolean | null;
    google_email?: string | null;
    status: string;
    assigned_student_count?: number | null;
    // auth-hydrated identity
    name?: string | null;
    email?: string | null;
    mobile_number?: string | null;
    profile_pic_file_id?: string | null;
}

export interface CreateMentorRequest {
    institute_id: string;
    user_id: string;
    display_name?: string;
    title?: string;
    profile_image_file_id?: string;
    bio?: string;
}

export interface UpdateMentorRequest {
    display_name?: string;
    title?: string;
    profile_image_file_id?: string;
    bio?: string;
    status?: string;
    booking_page_id?: string;
}

export interface AssignMentorRequest {
    institute_id: string;
    mentor_id: string;
    student_user_ids: string[];
    package_session_id?: string;
}

export interface BulkRoundRobinRequest {
    institute_id: string;
    student_user_ids: string[];
    mentor_ids: string[];
    package_session_id?: string;
}

export interface AssignmentResult {
    assigned: number;
    skipped: number;
}

export interface MenteeDTO {
    assignment_id: string;
    mentor_id: string;
    student_user_id: string;
    package_session_id?: string | null;
    assignment_method?: string | null;
    name?: string | null;
    email?: string | null;
    mobile_number?: string | null;
    profile_pic_file_id?: string | null;
}

export interface MentorDashboard {
    total_mentors: number;
    total_active_assignments: number;
    distinct_mentees: number;
    today_sessions?: number;
    upcoming_sessions?: number;
    mentors: MentorDTO[];
}

// Minimal enrolled-student row from the learner-list search (get/v2/all).
export interface StudentRow {
    user_id: string;
    full_name?: string;
    email?: string;
    username?: string;
}

// A note / activity from the shared timeline system.
export interface TimelineEvent {
    id: string;
    title: string;
    description?: string | null;
    action_type?: string | null;
    actor_name?: string | null;
    category?: string | null;
    is_pinned?: boolean | null;
    created_at?: string | number | null;
}

// A scheduled call from the booking system (by-lead feed).
export interface BookingInstance {
    id: string;
    booking_page_title?: string | null;
    invitee_name?: string | null;
    scheduled_start_utc?: string | number | null;
    scheduled_end_utc?: string | number | null;
    status: string;
    meet_link?: string | null;
}

export interface CreateNoteRequest {
    studentUserId: string;
    title: string;
    description?: string;
}

/** One weekly availability window (times are "HH:mm" in the page timezone). */
export interface WeeklyWindow {
    day_of_week: string; // MONDAY..SUNDAY
    start_time: string;
    end_time: string;
}

export interface BookingAvailability {
    weekly_windows: WeeklyWindow[];
    date_overrides?: unknown[] | null;
}

/** Subset of the mentor's booking page used by the availability editor. */
export interface MentorBookingPage {
    id: string;
    duration_minutes?: number | null;
    slot_granularity_minutes?: number | null;
    buffer_before_minutes?: number | null;
    buffer_after_minutes?: number | null;
    min_notice_minutes?: number | null;
    booking_horizon_days?: number | null;
    timezone?: string | null;
    availability?: BookingAvailability | null;
}

/** Mentor self-service availability update (host/slug are never sent). */
export interface MentorAvailabilityRequest {
    availability?: BookingAvailability;
    duration_minutes?: number;
    min_notice_minutes?: number;
    buffer_before_minutes?: number;
    buffer_after_minutes?: number;
    booking_horizon_days?: number;
    slot_granularity_minutes?: number;
    timezone?: string;
}
