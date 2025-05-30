// src/types/index.ts

// ----- API Response Types -----
export interface TextContent {
    id: string | null;
    type: string; // e.g., "HTML"
    content: string;
}

export interface Option {
    id: string;
    preview_id: string | null;
    question_id: string;
    text: TextContent;
    media_id: string;
    option_order: number | null;
    created_on?: string;
    updated_on?: string;
    explanation_text: TextContent | null;
}

export interface AddedQuestion {
    id: string;
    preview_id: string | null;
    section_id: string | null;
    question_order_in_section: number | null;
    text: TextContent;
    media_id: string;
    created_at: string;
    updated_at: string;
    question_response_type: string; // e.g., "OPTION", "TEXT_INPUT"
    question_type: string; // e.g., "MCQS", "SINGLE_CHOICE", "FREE_TEXT"
    access_level: string;
    auto_evaluation_json: string; // JSON string
    options_json: string | null; // JSON string
    parsed_evaluation_object: Record<string, any>;
    evaluation_type: string;
    explanation_text: TextContent;
    parent_rich_text_id: string | null;
    parent_rich_text: TextContent;
    default_question_time_mins: number | null;
    options: Option[];
    errors: any[];
    warnings: any[];
}

export enum SlideSourceType {
    Excalidraw = 'excalidraw',
    Question = 'question',
    // Add other types if backend supports, e.g., 'feedback' might use 'question' structure
}

export interface Slide {
    id: string;
    presentation_id: string | null;
    title: string;
    source_id: string; // For Excalidraw, this is the file ID
    source: SlideSourceType | string; // "excalidraw", "question"
    status: string | null;
    interaction_status: string;
    slide_order: number;
    default_time: number;
    content: string; // For Excalidraw, this is also the file ID. For Question, could be question_id or content_id.
    created_at: string | null;
    updated_at: string | null;
    added_question: AddedQuestion | null; // Present if source is "question"
    updated_question: AddedQuestion | null;
}

export interface PresentationSlides {
    id: string;
    title: string;
    description: string;
    cover_file_id: string;
    added_slides_count: number | null;
    added_slides: Slide[];
}

export interface SessionDetailsResponse {
    session_id: string;
    invite_code: string;
    session_status: 'INIT' | 'STARTED' | 'PAUSED' | 'ENDED' | 'CANCELLED';
    can_join_in_between: boolean;
    show_results_at_last_slide: boolean;
    allow_learner_hand_raise: boolean;
    default_seconds_for_question: number;
    student_attempts: number;
    excalidraw_data: any | null; // Define if structure is known
    allow_after_start: boolean;
    slides: PresentationSlides;
    current_slide_index: number; // 0-based index for 'added_slides' array
    creation_time: string;
    start_time: string | null;
    end_time: string | null;
}

export interface JoinSessionPayload {
    username: string;
    status?: 'INIT' | string; // Default to 'INIT'
}

// ----- SSE Event Types -----
export interface SseEventData {
    message?: string;
    status?: SessionDetailsResponse['session_status']; // e.g., 'INIT', 'STARTED', 'SLIDE_CHANGE', 'ENDED'
    type: 'SESSION_STATUS' | 'SLIDE_UPDATE' | 'SESSION_END' | 'ERROR' | string; // Backend specific event types
    currentSlideIndex?: number;
    totalSlides?: number;
    slide_data?: Slide; // If backend sends full slide data on change
    // ... other potential fields from SSE
}

// ----- Excalidraw Types (Simplified for viewing) -----
export interface ExcalidrawElement {
    type: string;
    // ... other Excalidraw element properties
    [key: string]: any;
}

export interface ExcalidrawAppState {
    viewBackgroundColor?: string;
    // ... other Excalidraw AppState properties
    [key: string]: any;
}

export interface ExcalidrawSceneData {
    elements: readonly ExcalidrawElement[];
    appState?: ExcalidrawAppState;
    files?: Record<string, any>; // BinaryFiles
}


// ----- UI State & Props -----
export interface UserSession {
    username: string;
    inviteCode: string;
    sessionId: string;
    sessionData: SessionDetailsResponse | null;
    currentSlide: Slide | null;
    sseStatus: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
    error: string | null;
}