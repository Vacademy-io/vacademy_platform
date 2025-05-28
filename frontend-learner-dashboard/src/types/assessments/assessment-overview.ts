export interface StudentDetailsQuestion {
    userId: string;
    name: string;
    batch?: string;
    enrollmentNumber?: string;
    gender: string;
    responseTime: number;
}

export interface ResponseQuestionList {
    type: string;
    studentDetails: StudentDetailsQuestion[];
}

export interface SubmissionStudentData {
    registration_id: string;
    student_name: string;
    attempt_date: string;
    and_time: string | null;
    score: number;
    attempt_id: string;
    user_id: string;
    duration: number;
    batch_id: string;
}

export interface StudentDetailsAttemptedOpen {
    userId: string;
    name: string;
    batch?: string;
    enrollmentNumber?: string;
    gender: string;
    attemptDate?: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    scoredMarks?: number;
    totalMarks?: number;
    phoneNo?: string;
    email?: string;
    city?: string;
    state?: string;
}

export interface StudentDetailsPendingOpen {
    userId: string;
    name: string;
    batch?: string;
    enrollmentNumber?: string;
    gender: string;
    phoneNo: string;
    email: string;
    city: string;
    state: string;
}

export interface StudentDetailsOngoingOpen {
    userId: string;
    name: string;
    batch?: string;
    enrollmentNumber?: string;
    gender: string;
    startTime: string;
}

interface StudentsData {
    type: string;
    studentDetails:
        | StudentDetailsAttemptedOpen[]
        | StudentDetailsPendingOpen[]
        | StudentDetailsOngoingOpen[];
}

export interface ResponseQuestionListOpen {
    participantsType: string;
    studentsData: StudentsData[];
}

export interface StudentDetailsAttemptedClose {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    attemptDate: string;
    startTime: string;
    endTime: string;
    duration: number;
    scoredMarks: number;
    totalMarks: number;
}

export interface StudentDetailsPendingClose {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    phoneNo: string;
    email: string;
    city: string;
    state: string;
}

export interface StudentDetailsOngoingClose {
    userId: string;
    name: string;
    batch: string;
    enrollmentNumber: string;
    gender: string;
    startTime: string;
}

export interface ResponseQuestionListClose {
    type: string;
    studentDetails:
        | StudentDetailsAttemptedClose[]
        | StudentDetailsPendingClose[]
        | StudentDetailsOngoingClose[];
}

export interface AssessmentReportStudentInterface {
    attempt_date: string; // ISO date string
    end_time: string; // ISO date string
    attempt_status: string; // Add other possible statuses if needed
    duration_in_seconds: number;
    assessment_status: string; // Add other possible statuses if needed
    attempt_id: string;
    start_time: string; // ISO date string
    assessment_id: string;
    total_marks: number;
    assessment_name: string;
    subject_id: string;
    __store: any;
}

export interface AssessmentReportInterface {
    content: AssessmentReportStudentInterface[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
