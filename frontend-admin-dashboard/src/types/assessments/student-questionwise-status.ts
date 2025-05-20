import { MyFilterOption } from "./my-filter";

export interface QuestionAssessmentStatusProps {
    assessmentId: string;
    sectionId: string | undefined;
    questionId: string | undefined;
    assesssmentType: string;
    questionStatus: string;
}

export interface StudentResponseQuestionwiseInterface {
    response_time_in_seconds: number;
    registration_id: string;
    status: string;
    attempt_id: string;
    participant_name: string;
    user_id: string;
    source: string;
    source_id: string;
}

export interface StudentQuestionwiseContent {
    content: StudentResponseQuestionwiseInterface[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}

export interface SelectedFilterQuestionWise {
    name: string;
    status: string[];
    assessment_visibility: string[];
    registration_source: string[];
    registration_source_id: MyFilterOption[];
    sort_columns: Record<string, string>; // Allows dynamic string keys with string values
}

export interface Step3ParticipantsListInterface {
    id: string;
    username: string;
    user_id: string;
    email: string;
    full_name: string;
    address_line: string;
    region: string | null;
    city: string;
    pin_code: string | null;
    mobile_number: string;
    date_of_birth: string | null;
    gender: string; // Assuming gender is an enum
    father_name: string;
    mother_name: string;
    parents_mobile_number: string;
    parents_email: string;
    linked_institute_name: string;
    package_session_id: string;
    institute_enrollment_id: string;
    status: string; // Assuming status values
    session_expiry_days: number | null;
    institute_id: string;
    face_file_id: string | null;
    expiry_date: string | null;
    created_at: string; // Using ISO date string format
    updated_at: string;
}

export interface Step3ParticipantsListIndiviudalStudentInterface {
    id: string;
    userId: string;
    instituteId: string;
    userEmail: string;
    username: string;
    participantName: string;
    faceFileId: string;
    reattemptCount: number;
    source: string;
    sourceId: string;
    phoneNumber: string;
    registrationTime: string; // Consider using Date type if you plan to parse it
    status: "ACTIVE" | "INACTIVE" | "PENDING"; // Add other possible statuses if applicable
    assessmentRegistrationCustomFieldResponseList: string[]; // Define a proper type if available
    studentAttempts: string[]; // Define a proper type if available
    createdAt: string; // Consider using Date type
    updatedAt: string; // Consider using Date type
}
