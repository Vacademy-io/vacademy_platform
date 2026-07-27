import { SubjectType } from '@/stores/study-library/use-study-library-store';
import { Module } from '@/stores/study-library/use-modules-with-chapters-store';

export interface ChapterWithProgress {
    id: string;
    chapter_name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
    last_slide_viewed: string;
    percentage_completed: number;
    video_count: number;
    pdf_count: number;
    doc_count: number;
    unknown_count: number;
}

export interface ModulesWithChaptersProgressType {
    module: Module;
    // Canonical stored module completion (learner_operation PERCENTAGE_MODULE_COMPLETED,
    // COALESCE 0 when untracked). Present on the /subject/learner/v1/subjects response;
    // used to reproduce the backend course rollup so the admin number matches the learner's.
    percentage_completed?: number;
    chapters: ChapterWithProgress[];
}

export interface SubjectWithDetails {
    subject_dto: SubjectType;
    modules: ModulesWithChaptersProgressType[];
}

export type StudentSubjectsDetailsTypes = SubjectWithDetails[];
