export interface InitiateAnalysisRequest {
    user_id: string;
    institute_id: string;
    start_date_iso: string;
    end_date_iso: string;
    report_version?: 'v1' | 'v2';
    batch_id?: string;
    package_session_id?: string;
    /** v2 only: which modules to include. Omit/empty → all modules. */
    include_modules?: string[];
    /** Optional admin-supplied name. Omit to let the backend auto-generate "Report: <start> to <end>". */
    name?: string;
    /** Email the learner when ready. Default true (opt-out). Push + in-app alerts are always sent. */
    send_email?: boolean;
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
    report_version?: 'v1' | 'v2';
    /** Admin-supplied or auto-generated report name from the backend. */
    name?: string;
}

export interface ReportListResponse {
    reports: StudentReport[];
    current_page: number;
    total_pages: number;
    total_elements: number;
    page_size: number;
}

// ── V2 comprehensive report types ─────────────────────────────────────────────

export interface StudentIdentitySection {
    available: boolean;
    user_id: string;
    name: string;
    enrollment_no: string;
    batch: string;
    enrolled_date: string;
    status: string;
    parents_email: string;
    guardian_email: string;
}

export interface InstituteSection {
    id: string;
    name: string;
    logo_file_id: string;
}

export interface ReportPeriodSection {
    start_date_iso: string;
    end_date_iso: string;
    generated_at: string;
}

export interface AttendanceSessionItem {
    date: string;
    title: string;
    subject: string;
    status: string;
    duration_minutes: number;
    engagement: Record<string, unknown>;
}

export interface AttendanceSection {
    available: boolean;
    overall_percentage: number;
    present: number;
    absent: number;
    unmarked: number;
    sessions: AttendanceSessionItem[];
}

export interface AcademicsSectionItem {
    assessment_id: string;
    assessment_name: string;
    attempt_id: string;
    attempt_date: string;
    marks: number;
    total_marks: number;
    percentage: number;
    result_status: string;
    duration_seconds: number;
    rank: number;
    percentile: number;
    accuracy: number;
    class_average_marks: number;
    class_accuracy: number;
    sections: Array<{
        section_id: string;
        section_name: string;
        student_marks: number;
        section_total_marks: number;
        section_average_marks: number;
        student_accuracy: number;
        class_accuracy: number;
    }>;
}

export interface AcademicsAverages {
    total_assessments: number;
    avg_percentage: number;
    best_assessment: string;
    weakest_assessment: string;
}

export interface AcademicsSection {
    available: boolean;
    assessments: AcademicsSectionItem[];
    averages: AcademicsAverages;
}

export interface DailyTimeEntry {
    date: string;
    minutes: number;
}

export interface ActivitySection {
    available: boolean;
    total_time_minutes: number;
    daily_time: DailyTimeEntry[];
    avg_concentration: number | null;
    content_engagement: Record<string, number>;
}

export interface SubjectProgress {
    subject_id: string;
    name: string;
    percentage: number;
    time_minutes: number;
}

export interface ProgressSection {
    available: boolean;
    course_completion_percentage: number;
    subjects: SubjectProgress[];
}

export interface LiveClassesSection {
    available: boolean;
    attended: number;
    missed: number;
    unmarked: number;
    total?: number;
    attendance_percentage?: number;
    participation: Record<string, unknown>;
}

export interface CertificateItem {
    certificate_id: string;
    course_name: string;
    completion_percentage: number;
    issued_at: string;
    file_id: string;
}

export interface AssignmentItem {
    slide_id: string;
    title: string;
    marks: number | null;
    score_percentage?: number | null;
    late: boolean;
    feedback: string;
    review_status: string;
}

export interface AssignmentsSection {
    available: boolean;
    assigned?: number | null;
    submitted: number;
    on_time?: number | null;
    graded: number;
    late: number;
    pending?: number | null;
    avg_score_percentage?: number | null;
    items: AssignmentItem[];
}

export interface DoubtsSection {
    available: boolean;
    raised: number;
    resolved: number;
    avg_resolution_hours: number;
}

export interface LoginSection {
    available: boolean;
    total_logins: number;
    last_login: string;
    avg_session_minutes: number;
    total_active_time_minutes: number;
}

export interface RecommendationItem {
    priority: string;
    area: string;
    suggestion: string;
}

export interface AiInsightsSection {
    summary: string;
    cross_domain_insights: string[];
    strengths: Record<string, number>;
    weaknesses: Record<string, number>;
    recommendations: RecommendationItem[];
    section_commentary: Record<string, string>;
}

export interface ComprehensiveStudentReport {
    report_version: 'v2';
    student: StudentIdentitySection;
    institute: InstituteSection;
    period: ReportPeriodSection;
    attendance: AttendanceSection;
    academics: AcademicsSection;
    activity: ActivitySection;
    progress: ProgressSection;
    live_classes: LiveClassesSection;
    certificates: CertificateItem[];
    assignments: AssignmentsSection;
    doubts: DoubtsSection;
    login: LoginSection;
    ai_insights: AiInsightsSection | null;
}

export interface StudentReportFull {
    process_id: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ERROR';
    report_version?: 'v1' | 'v2';
    report: StudentReportData | null;
    comprehensive_report: ComprehensiveStudentReport | null;
    error_message?: string | null;
    /** Admin-supplied or auto-generated report name from the backend. */
    name?: string;
}

// ── V2 new-shape report types (matches student-report-sample.json) ─────────────

export interface V2HeadlineMetric {
    key: string;
    label: string;
    value: number | string;
    unit?: string;
    trend?: 'up' | 'down' | 'steady';
    change?: string;
    sentiment?: 'good' | 'neutral' | 'attention' | 'bad';
}

export interface V2AttendanceWeekly {
    week: string;
    percentage: number;
}

export interface V2SubjectPerformance {
    subject: string;
    score_percentage: number;
    class_average: number;
    trend?: 'up' | 'down' | 'steady';
    sentiment?: 'good' | 'neutral' | 'attention' | 'bad';
}

export interface V2Assessment {
    name: string;
    date: string;
    subject: string;
    marks: number;
    total_marks: number;
    percentage: number;
    grade: string;
    rank?: number;
    percentile?: number;
    class_average?: number;
    status: string;
}

export interface V2StudyHabitsContentEngagement {
    videos_watched: number;
    documents_read: number;
    quizzes_attempted: number;
}

export interface V2DailyStudyMinute {
    date: string;
    minutes: number;
}

export interface V2CourseProgressSubject {
    subject: string;
    completion_percentage: number;
    time_hours: number;
}

export interface V2LiveClassParticipation {
    questions_asked: number;
    polls_answered: number;
    avg_engagement: string;
}

export interface V2Strength {
    topic: string;
    confidence: number;
}

export interface V2Achievement {
    title: string;
    issued_at: string;
    type?: string;
    course_name?: string;
    completion_percentage?: number;
}

export interface V2Recommendation {
    priority: string;
    area: string;
    suggestion: string;
}

export interface V2SubjectMarksItem {
    subject: string;
    marks_obtained: number;
    total_marks: number;
    percentage: number;
    item_count: number;
    topics?: string[];
}

export interface V2GradedItem {
    type: 'ASSESSMENT' | 'ASSIGNMENT' | 'QUIZ' | 'QUESTION';
    title: string;
    subject?: string;
    marks_obtained: number;
    total_marks: number;
}

export interface V2ReportData {
    meta: {
        report_version: string;
        report_name: string;
        report_id: string;
        generated_at: string;
        language: string;
    };
    student: {
        name: string;
        class: string;
        batch: string;
        enrollment_no: string;
        roll_no: string;
        avatar_url?: string | null;
    };
    institute: {
        name: string;
        logo_url?: string | null;
        theme_color?: string;
    };
    period: {
        start_date: string;
        end_date: string;
        label: string;
        days: number;
    };
    overview: {
        overall_status: string;
        overall_grade: string;
        one_line: string;
        headline_metrics: V2HeadlineMetric[];
    };
    parent_summary?: string;
    attendance?: {
        available: boolean;
        overall_percentage: number;
        present: number;
        absent: number;
        late: number;
        total_sessions: number;
        trend?: string;
        change_vs_previous?: string;
        note?: string;
        weekly?: V2AttendanceWeekly[];
    };
    academics?: {
        available: boolean;
        average_percentage: number;
        class_average_percentage: number;
        best_subject: string;
        weakest_subject: string;
        assessments: V2Assessment[];
        subject_performance: V2SubjectPerformance[];
    };
    study_habits?: {
        available: boolean;
        total_study_hours: number;
        avg_minutes_per_day: number;
        active_days: number;
        total_days: number;
        longest_streak_days: number;
        consistency_rating: string;
        most_active_time: string;
        focus_score: number;
        content_engagement: V2StudyHabitsContentEngagement;
        daily_study_minutes: V2DailyStudyMinute[];
    };
    course_progress?: {
        available: boolean;
        overall_completion_percentage: number;
        subjects: V2CourseProgressSubject[];
    };
    live_classes?: {
        available: boolean;
        attended: number;
        missed: number;
        unmarked?: number;
        total: number;
        attendance_percentage: number;
        participation: V2LiveClassParticipation;
    };
    assignments?: {
        available: boolean;
        assigned: number;
        submitted: number;
        on_time: number;
        late: number;
        pending: number;
        avg_score_percentage: number;
    };
    subject_marks?: {
        available: boolean;
        subjects: V2SubjectMarksItem[];
        items?: V2GradedItem[];
    };
    strengths?: V2Strength[];
    areas_to_improve?: V2Strength[];
    achievements?: V2Achievement[];
    doubts_and_engagement?: {
        available: boolean;
        questions_asked: number;
        resolved: number;
        avg_resolution_hours: number;
        note?: string;
    };
    ai_insights?: {
        summary: string;
        cross_domain_insights: string[];
        recommendations: V2Recommendation[];
        section_commentary: Record<string, string>;
    };
    learning_insights?: V2LearningInsights;
    narrative?: V2Narrative;
    data_notes?: string[];
}

export interface V2LearningInsights {
    available: boolean;
    attempts_analyzed?: number;
    topic_mastery?: V2TopicMastery[];
    blooms?: V2BloomLevel[];
    confidence?: V2ConfidenceProfile;
    misconceptions?: V2Misconception[];
}

export interface V2TopicMastery {
    topic: string;
    questions?: number;
    correct?: number;
    accuracy?: number;
    avg_time_seconds?: number;
    mastery_level?: string;
}

export interface V2BloomLevel {
    level: string;
    total?: number;
    correct?: number;
    accuracy?: number;
}

export interface V2ConfidenceProfile {
    overall?: number;
    knows?: number;
    guesses?: number;
    high_confidence_wrong?: number;
}

export interface V2Misconception {
    topic?: string;
    context?: string;
    misconception?: string;
    remediation?: string;
}

export interface V2Narrative {
    learning_frequency?: string;
    progress?: string;
    student_efforts?: string;
    topics_of_improvement?: string;
    topics_of_degradation?: string;
    remedial_points?: string;
}

