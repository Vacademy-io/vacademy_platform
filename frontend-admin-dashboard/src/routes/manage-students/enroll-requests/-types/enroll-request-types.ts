import { LearnerInvitationType } from '../../invite/-types/create-invitation-types';

export interface FilterRequestType {
    status: string[];
    name: string;
}

export interface CustomFieldResponseType {
    custom_field_id: string;
    id: string;
    value: string;
    field_name: string;
}

export interface LearnerInvitationResponseType {
    id: string;
    institute_id: string;
    learner_invitation_id: string;
    status: 'ACTIVE' | 'INACTIVE';
    full_name: string;
    email: string;
    contact_number: string;
    batch_options_json: string;
    batch_selection_response_json: string;
    recorded_on: string;
    custom_fields_response: CustomFieldResponseType[];
}

export interface ContentType {
    learner_invitation_response_dto: LearnerInvitationResponseType;
    learner_invitation: LearnerInvitationType;
}

export interface GetResponseListType {
    content: ContentType[];
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
