export interface BookingType {
    id: string;
    type: string; // Display name: "School Visit"
    code: string; // Unique code: "SCHOOL_VISIT"
    description?: string;
    institute_id?: string; // null = global, otherwise institute-specific
    created_at: string;
    updated_at: string;
}

export interface CalendarEvent {
    session_id: string;
    schedule_id: string;
    title: string;
    subject?: string;
    date: string; // "2024-05-20"
    start_time: string; // "10:00:00"
    end_time: string; // "11:00:00"
    status: string; // "LIVE", "DRAFT", "CANCELLED", "COMPLETED"
    booking_type_id?: string;
    booking_type_name?: string;
    source?: string;
    source_id?: string;
    meeting_link?: string;
    access_level: string;
    timezone: string;
    participants?: ParticipantInfo[];
}

export interface UserBasicDetail {
    user_id: string;
    first_name: string;
    last_name?: string;
    email: string;
    mobile_number?: string;
    profile_pic_url?: string;
}

export interface ParticipantInfo {
    id: string;
    source_type: 'USER' | 'BATCH';
    source_id: string;
    name?: string;
    email?: string;
}

export interface BookingDetail {
    session_id: string;
    title: string;
    subject?: string;
    description_html?: string;
    status: string;
    access_level: string;
    timezone: string;

    // Booking Type
    booking_type_id?: string;
    booking_type_name?: string;
    booking_type_code?: string;

    // Source (linked entity)
    source?: string;
    source_id?: string;

    // Schedule
    schedule_id?: string;
    meeting_date?: string;
    start_time?: string;
    end_time?: string;
    meeting_link?: string;

    // Participants
    participants: ParticipantInfo[];

    created_by_user_id: string;
    created_at: string;
    updated_at: string;
}

export interface CreateBookingRequest {
    institute_id: string;
    title: string;
    subject?: string;
    description_html?: string;
    start_time: string;
    last_entry_time: string;
    session_end_date: string;
    booking_type_id?: string;
    booking_type?: string;
    source?: string;
    source_id?: string;
    participant_user_ids?: string[];
    default_meet_link?: string;
    time_zone?: string;
    recurrence_type?: string;
}

export interface BookingSearchParams {
    institute_id: string;
    booking_type_ids?: string[];
    source?: string;
    source_id?: string;
    time_status?: 'UPCOMING' | 'PAST' | 'LIVE';
    page: number;
    size: number;
}

export interface PaginatedBookingTypeResponse {
    content: BookingType[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
