type Pagination<T> = {
    totalPages: number;
    totalElements: number;
    pageable: {
        pageNumber: number;
        pageSize: number;
        paged: boolean;
        unpaged: boolean;
        offset: number;
        sort: {
            sorted: boolean;
            unsorted: boolean;
            empty: boolean;
        };
    };
    numberOfElements: number;
    size: number;
    content: T[];
    number: number;
    sort: {
        sorted: boolean;
        unsorted: boolean;
        empty: boolean;
    };
    first: boolean;
    last: boolean;
    empty: boolean;
};

type LearnerInvitationResponse = {
    id: string;
    institute_id: string;
    learner_invitation_id: string;
    status: string;
    full_name: string;
    email: string;
    contact_number: string;
    batch_options_json: string;
    batch_selection_response_json: string;
    recorded_on: string; // ISO timestamp
    custom_fields_response: {
        custom_field_id: string;
        id: string;
        value: string;
        field_name: string;
    }[];
};

type LearnerInvitation = {
    id: string;
    name: string;
    status: string;
    date_generated: string; // ISO timestamp
    expiry_date: string; // ISO timestamp
    institute_id: string;
    invite_code: string;
    batch_options_json: string;
    custom_fields: {
        id: string;
        field_name: string;
        field_type: string;
        default_value: string;
        description: string;
        is_mandatory: boolean;
        comma_separated_options: string;
        status: string;
    }[];
};

export type LearnerInvitationData = {
    learner_invitation_response_dto: LearnerInvitationResponse;
    learner_invitation: LearnerInvitation;
};

export type LearnerInvitationPagination = Pagination<LearnerInvitationData>;

interface BatchSelectionJsonResponse {
    package_id: string;
    selected_sessions: {
        session_id: string;
        selected_levels: string[];
    }[];
}

export type BatchSelectionJsonResponses = BatchSelectionJsonResponse[];
