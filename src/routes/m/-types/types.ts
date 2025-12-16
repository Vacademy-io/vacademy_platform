// Types for public media API response
export interface PublicMediaDetails {
    id: string;
    url: string;
    file_name: string;
    file_type: string;
    source: string;
    source_id: string;
    expiry: string;
    width: number;
    height: number;
    created_on: string;
    updated_on: string;
}

// Supported media sources
export enum MediaSource {
    YOUTUBE = "YOUTUBE",
    VIDEO = "VIDEO",
    PDF = "PDF",
    IMAGE = "IMAGE",
    DOCUMENT = "DOCUMENT",
}
