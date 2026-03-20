export interface Subject {
    id: string;
    name: string;
    status: string;
}

export interface Faculty {
    id: string;
    userId: string;
    name: string;
    subjects: Subject[];
}

export interface PaginatedFacultyResponse {
    content: Faculty[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}
