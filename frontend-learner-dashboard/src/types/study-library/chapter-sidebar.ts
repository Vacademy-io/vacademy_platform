export type SlideFileType = "pdf" | "video" 

export interface SidebarContentItem {
    id: string;
    type: SlideFileType;
    name: string;
    url: string;
    content: string ; // Allow both string and YooptaContentValue
    createdAt: Date;
}
