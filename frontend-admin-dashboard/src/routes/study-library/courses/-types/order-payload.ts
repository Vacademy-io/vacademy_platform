export interface orderSubjectPayloadType {
    subject_id: string;
    package_session_id: string;
    subject_order: number;
}

export interface orderModulePayloadType {
    subject_id: string;
    module_id: string;
    module_order: number;
}

export interface orderChapterPayloadType {
    chapter_id: string;
    package_session_id: string;
    chapter_order: number;
}
