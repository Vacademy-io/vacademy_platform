export interface AssessmentOverviewDataInterface {
    start_date_and_time: string;
    total_participants: number;
    created_on: string;
    end_date_and_time: string;
    duration_in_min: number;
    average_duration: number;
    average_marks: number;
    total_attempted: number;
    total_ongoing: number;
    subject_id: string;
}

export interface AssessmentOverviewMarksRankInterface {
    percentile: number;
    no_of_participants: number;
    marks: number;
    rank: number;
}

export interface AssessmentOverviewRankMarkInterface {
    assessment_overview_dto: AssessmentOverviewDataInterface;
    marks_rank_dto: AssessmentOverviewMarksRankInterface[];
}

interface Level {
    id: string;
    level_name: string;
    duration_in_days: number | null;
    thumbnail_id: string | null;
}

interface Session {
    id: string;
    session_name: string;
    status: string;
}

interface PackageDto {
    id: string;
    package_name: string;
    thumbnail_file_id?: string | null;
}

export interface BatchDetailsInterface {
    id: string;
    level: Level;
    session: Session;
    start_time: string | null;
    status: string;
    package_dto: PackageDto;
}

export interface StudentLeaderboard {
    student_name: string;
    completion_time_in_seconds: number;
    achieved_marks: number;
    attempt_id: string;
    batch_id: string;
    rank: number;
    user_id: string;
    percentile: number;
}

export interface StudentLeaderboardData {
    content: StudentLeaderboard[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
