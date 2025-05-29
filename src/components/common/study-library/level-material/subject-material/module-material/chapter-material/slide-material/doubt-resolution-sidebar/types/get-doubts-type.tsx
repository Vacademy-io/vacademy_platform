import { DoubtType } from "./add-doubt-type";

export interface Doubt extends DoubtType  {
    id: string;
    replies: Doubt[]; // Recursive structure for nested replies
}
  
export interface PaginatedDoubtResponse {
    content: Doubt[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
  

export interface DoubtFilter {
    name: string;
    start_date: string; // ISO timestamp
    end_date: string; // ISO timestamp
    user_ids: string[];
    content_positions: string[]; // Format: HH:MM:SS
    content_types: string[];
    sources: string[];
    source_ids: string[];
    status: string[];
    sort_columns: {
      [key: string]: 'ASC' | 'DESC';
    };
}
  