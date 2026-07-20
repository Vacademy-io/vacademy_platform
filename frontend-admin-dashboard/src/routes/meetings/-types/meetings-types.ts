// Shared types for the CRM Meetings feature (booking pages + host calendars).
// API payloads are snake_case, mirroring the backend DTOs under
// /admin-core-service/v1/meetings.

export type MeetingLocationType = 'GOOGLE_MEET' | 'CUSTOM_LINK' | 'IN_PERSON' | 'PHONE';

export type ReminderChannel = 'EMAIL' | 'WHATSAPP';

export type DayOfWeek =
    | 'MONDAY'
    | 'TUESDAY'
    | 'WEDNESDAY'
    | 'THURSDAY'
    | 'FRIDAY'
    | 'SATURDAY'
    | 'SUNDAY';

export interface WeeklyWindow {
    day_of_week: DayOfWeek;
    /** HH:mm */
    start_time: string;
    /** HH:mm */
    end_time: string;
}

export interface AvailabilityConfig {
    weekly_windows: WeeklyWindow[];
    date_overrides?: unknown[];
}

export interface ReminderConfig {
    on_booking_confirmation?: boolean;
    channels?: ReminderChannel[];
    before_meeting_offsets_minutes?: number[];
}

export interface BookingPageDTO {
    id?: string;
    institute_id: string;
    audience_id?: string | null;
    host_user_id?: string | null;
    booking_type_id?: string | null;
    slug?: string | null;
    title: string;
    description?: string | null;
    duration_minutes?: number | null;
    slot_granularity_minutes?: number | null;
    buffer_before_minutes?: number | null;
    buffer_after_minutes?: number | null;
    min_notice_minutes?: number | null;
    booking_horizon_days?: number | null;
    timezone?: string | null;
    location_type?: MeetingLocationType | null;
    custom_meeting_link?: string | null;
    allocate_google_meet?: boolean | null;
    require_approval?: boolean | null;
    availability?: AvailabilityConfig | null;
    reminder_config?: ReminderConfig | null;
    status?: string | null;
    host_name?: string | null;
    created_at?: string | null;
}

export interface CreateMeetingBookingRequest {
    institute_id: string;
    booking_page_id?: string;
    host_user_id?: string;
    title?: string;
    description?: string;
    /** ISO-8601 with offset, e.g. 2026-07-22T10:00:00+05:30 */
    start_time: string;
    duration_minutes?: number;
    /** IANA timezone */
    timezone?: string;
    participant_user_ids?: string[];
    invitee_user_id?: string;
    audience_response_id?: string;
    invitee_name?: string;
    invitee_email?: string;
    invitee_phone?: string;
    invitee_timezone?: string;
    location_type?: MeetingLocationType;
    custom_meeting_link?: string;
    allocate_google_meet?: boolean;
    reminder_config?: ReminderConfig;
}

export type BookingInstanceStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | string;

export interface BookingInstanceDTO {
    id: string;
    booking_page_id?: string | null;
    booking_page_title?: string | null;
    live_session_id?: string | null;
    schedule_id?: string | null;
    host_user_id?: string | null;
    host_name?: string | null;
    invitee_name?: string | null;
    invitee_email?: string | null;
    invitee_phone?: string | null;
    scheduled_start_utc: string;
    scheduled_end_utc: string;
    status: BookingInstanceStatus;
    meet_link?: string | null;
    created_at?: string | null;
}

export interface MeetingsScope {
    is_admin: boolean;
    is_team_manager: boolean;
    team_user_ids: string[];
}
