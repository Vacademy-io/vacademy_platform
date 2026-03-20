export interface UserPlan {
    id: string;
    name: string;
    description?: string;
    type: 'SUBSCRIPTION' | 'UPFRONT' | 'DONATION' | 'FREE';
    currency: string;
    status: 'ACTIVE' | 'EXPIRED' | 'DRAFT' | 'PUBLISHED';
    validity_in_days?: number;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    updated_by?: string;
}

export interface PaginationMeta {
    pageNo: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
}

export interface UserPlansResponse {
    contents: UserPlan[];
    pageable?: {
        pageNumber: number;
        pageSize: number;
    };
    totalElements?: number;
    totalPages?: number;
}
