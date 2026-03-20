export interface SlideWithStatusType {
    slide_title: string | null;
    document_id: string | null;
    document_title: string | null;
    document_type: string;
    slide_description: string | null;
    document_cover_file_id: string | null;
    video_description: string | null;
    document_data: string | null;
    video_id: string | null;
    video_title: string | null;
    video_url: string | null;
    slide_id: string;
    source_type: string;
    status: string;
    document_last_page: string | null;
    document_last_updated: string | null;
    video_last_timestamp: string | null;
    video_last_updated: string | null;
    image_file_id: string | null;
    percentage_video_watched: string | null;
    percentage_document_watched: string | null;
    slide_order: number | null;
}

export type SlideWithProgressType = SlideWithStatusType[];
