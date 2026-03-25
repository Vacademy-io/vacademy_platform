interface Sort {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
}

interface Pageable {
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    unpaged: boolean;
    offset: number;
    sort: Sort;
}

export interface UserActivity {
    totalTimeSpent: number;
    lastActive: string;
    userId: string;
    fullName: string;
}

export interface PaginatedResponse {
    totalPages: number;
    totalElements: number;
    pageable: Pageable;
    size: number;
    content: UserActivity[];
    number: number;
    sort: Sort;
    numberOfElements: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}
