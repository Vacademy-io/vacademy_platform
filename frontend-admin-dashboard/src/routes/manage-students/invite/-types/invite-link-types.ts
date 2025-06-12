export interface InviteLinkType {
    accepted_by: number;
    date_generated: string;
    institute_id: string;
    name: string;
    id: string;
    invite_code: string;
}

export interface InviteListType {
    totalPages: number;
    totalElements: number;
    pageable: {
        pageNumber: number;
        pageSize: number;
        paged: boolean;
        unpaged: boolean;
        offset: number;
        sort: {
            unsorted: boolean;
            sorted: boolean;
            empty: boolean;
        };
    };
    numberOfElements: number;
    size: number;
    content: InviteLinkType[];
    number: number;
    sort: {
        unsorted: boolean;
        sorted: boolean;
        empty: boolean;
    };
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface InviteFilterRequest {
    status: string[];
    name: string;
}
