// Types for course comparison with parent_id tracking

export interface ModuleWithParent {
    id: string;
    module_name: string;
    status: string;
    description: string;
    thumbnail_id: string;
    parent_id: string | null; // null means newly added
}

export interface ChapterWithParent {
    id: string;
    chapter_name: string;
    status: string;
    file_id: string | null;
    description: string;
    chapter_order: number;
    parent_id: string | null; // null means newly added
}

export interface SlideWithParent {
    id: string;
    source_id: string;
    source_type: string;
    title: string;
    image_file_id: string | null;
    description: string | null;
    status: string;
    slide_order: number;
    video_slide?: any;
    document_slide?: {
        id: string;
        type: string;
        data: string | null;
        title: string;
        cover_file_id: string;
        total_pages: number | null;
        published_data: string;
        published_document_total_pages: number;
    };
    question_slide?: any;
    assignment_slide?: any;
    quiz_slide?: any;
    is_loaded: boolean;
    parent_id: string | null; // null means newly added
    new_slide: boolean;
}

export interface ModuleWithChaptersComparison {
    module: ModuleWithParent;
    chapters: {
        chapter: ChapterWithParent;
        slides_count: {
            video_count: number;
            pdf_count: number;
            doc_count: number;
            unknown_count: number;
        };
        chapter_in_package_sessions: string[];
    }[];
}

export interface ChapterWithSlidesComparison {
    chapter: ChapterWithParent;
    slides: SlideWithParent[];
}

// Comparison result types
export type ChangeType = 'added' | 'deleted' | 'updated' | 'unchanged';

export interface ComparisonItem {
    id: string;
    name: string;
    type: 'subject' | 'module' | 'chapter' | 'slide';
    changeType: ChangeType;
    originalData?: any;
    currentData?: any;
    changes?: string[]; // List of what changed (name, description, etc.)
}

export interface CourseComparisonResult {
    subjects: ComparisonItem[];
    modules: ComparisonItem[];
    chapters: ComparisonItem[];
    slides: ComparisonItem[];
    summary: {
        totalAdded: number;
        totalDeleted: number;
        totalUpdated: number;
        totalUnchanged: number;
    };
    isNewCourse?: boolean; // Added for new course detection
}

export interface PackageSession {
    id: string;
    name: string;
}

// API Response types matching the backend format
export interface ModulesWithChaptersResponse {
    module: {
        id: string;
        module_name: string;
        status: string;
        description: string;
        thumbnail_id: string;
        parent_id: string | null;
    };
    chapters: {
        chapter: {
            id: string;
            chapter_name: string;
            status: string;
            file_id: string | null;
            description: string;
            chapter_order: number;
            parent_id: string | null;
        };
        slides_count: {
            video_count: number;
            pdf_count: number;
            doc_count: number;
            unknown_count: number;
        };
        chapter_in_package_sessions: string[];
    }[];
}

export interface ChaptersWithSlidesResponse {
    chapter: {
        id: string;
        chapter_name: string;
        status: string;
        file_id: string;
        description: string;
        chapter_order: number;
        parent_id: string | null;
    };
    slides: {
        id: string;
        source_id: string;
        source_type: string;
        title: string;
        image_file_id: string | null;
        description: string | null;
        status: string;
        slide_order: number;
        video_slide?: any;
        document_slide?: {
            id: string;
            type: string;
            data: string | null;
            title: string;
            cover_file_id: string;
            total_pages: number | null;
            published_data: string;
            published_document_total_pages: number;
        };
        question_slide?: any;
        assignment_slide?: any;
        quiz_slide?: any;
        is_loaded: boolean;
        parent_id: string | null;
        new_slide: boolean;
    }[];
}
