interface Sort {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
}

interface Pageable {
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    unpaged: boolean;
    offset: number;
    sort: Sort;
}

interface Video {
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
}

interface Document {
    id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
    page_number: number;
}

export interface ActivityContent {
    id: string;
    source_id: string;
    source_type: string;
    user_id: string;
    slide_id: string;
    start_time_in_millis: number;
    end_time_in_millis: number;
    percentage_watched: number;
    videos: Video[];
    documents: Document[];
    new_activity: boolean;
    concentration_score: {
        id: string;
        concentration_score: number;
        tab_switch_count: number;
        pause_count: number;
        answer_times_in_seconds: number[];
    } | null;
    question_slides: QuestionSlide[];
    assignment_slides: AssignmentSlide[];
    video_slides_questions: VideoSlideQuestion[];
}
export interface QuestionSlide {
    id: string;
    attempt_number: number;
    response_json: string;
    response_status: string;
    marks: number;
}

export interface AssignmentSlide {
    id: string;
    comma_separated_file_ids: string;
    date_submitted: string; // ISO string, e.g. "2025-05-17T07:22:31.439Z"
    marks: number;
}

export interface VideoSlideQuestion {
    id: string;
    response_json: string;
    response_status: string;
}

export interface ActivityResponse {
    totalPages: number;
    totalElements: number;
    pageable: Pageable;
    size: number;
    content: ActivityContent[];
    number: number;
    sort: Sort;
    numberOfElements: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}
