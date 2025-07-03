export interface CourseStructureResponse {
    course: Course;
    sessions: Session[];
}

export interface Course {
    id: string;
    package_name: string;
    thumbnail_file_id: string;
    status: "ACTIVE" | "INACTIVE";
    is_course_published_to_catalaouge: boolean;
    course_preview_image_media_id: string;
    course_banner_media_id: string;
    course_media_id: string;
    why_learn: string;
    who_should_learn: string;
    about_the_course: string;
    tags: string[] | null;
    course_depth: number;
    course_html_description: string;
}

export interface Session {
    level_with_details: LevelDetail[];
    session_dto: SessionDto;
}

export interface LevelDetail {
    id: string;
    name: string;
    duration_in_days: number;
    subjects: Subject[];
}

export interface Subject {
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    subject_order: number | null;
}

export interface SessionDto {
    id: string;
    session_name: string;
    status: "ACTIVE" | "INACTIVE";
    start_date: string; // ISO date string
}
