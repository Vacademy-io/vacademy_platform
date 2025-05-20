export interface CustomFieldType {
    id: string;
    field_name: string;
    field_type: string;
    default_value: string | null;
    description: string;
    is_mandatory: boolean;
    comma_separated_options: string;
    status?: string;
}

export interface InviteLevelType {
    id: string;
    name: string;
    package_session_id: string | null;
}

export interface LearnerChoiceSessionType {
    max_selectable_levels: number;
    id: string;
    name: string;
    learner_choice_levels: InviteLevelType[];
}

export interface PreSelectedSessionType {
    id: string;
    name: string;
    institute_assigned: boolean;
    max_selectable_levels: number;
    pre_selected_levels: InviteLevelType[];
    learner_choice_levels: InviteLevelType[];
}

export interface PreSelectedPackagesType {
    id: string;
    name: string;
    institute_assigned: boolean;
    max_selectable_sessions: number;
    pre_selected_session_dtos: PreSelectedSessionType[];
    learner_choice_sessions: LearnerChoiceSessionType[];
}

export interface LearnerChoicePackagesType {
    id: string;
    name: string;
    max_selectable_sessions: number;
    learner_choice_sessions: LearnerChoiceSessionType[];
}

export interface BatchOptionJsonType {
    institute_assigned: boolean;
    max_selectable_packages: number;
    pre_selected_packages: PreSelectedPackagesType[];
    learner_choice_packages: LearnerChoicePackagesType[];
}

export interface LearnerInvitationType {
    id: string | null;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    date_generated: string | null;
    expiry_date: string;
    institute_id: string;
    invite_code: string | null;
    batch_options_json: string;
    custom_fields: CustomFieldType[];
}
export interface CreateInvitationRequestType {
    emails_to_send_invitation: string[];
    learner_invitation: LearnerInvitationType;
}
