export interface InitiateAnalysisRequest {
    user_id: string;
    institute_id: string;
    start_date_iso: string;
    end_date_iso: string;
}

export interface InitiateAnalysisResponse {
    process_id: string | null;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ERROR';
    message: string;
}

export interface StudentReportData {
    learning_frequency: string;
    student_efforts: string;
    progress: string;
    topics_of_improvement: string;
    topics_of_degradation: string;
    remedial_points: string;
    strengths: Record<string, number>;
    weaknesses: Record<string, number>;
}

export interface StudentReport {
    process_id: string;
    user_id: string;
    institute_id: string;
    start_date_iso: string;
    end_date_iso: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ERROR';
    created_at: string;
    updated_at: string;
    report: StudentReportData | null;
    error_message?: string | null;
}

export interface ReportListResponse {
    reports: StudentReport[];
    current_page: number;
    total_pages: number;
    total_elements: number;
    page_size: number;
}
