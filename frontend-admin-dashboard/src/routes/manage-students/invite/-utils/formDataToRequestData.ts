import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import {
    InviteForm,
    LearnerChoiceCourse,
    PreSelectedCourse,
    LearnerChoiceSession,
    PreSelectedSession,
    LevelField,
} from '../-schema/InviteFormSchema';
import {
    BatchOptionJsonType,
    CreateInvitationRequestType,
    CustomFieldType,
    InviteLevelType,
    LearnerChoicePackagesType,
    LearnerChoiceSessionType,
    PreSelectedPackagesType,
    PreSelectedSessionType,
} from '../-types/create-invitation-types';
import { TokenKey } from '@/constants/auth/tokens';
import { createBatchOptions } from './formFormatToRequest';
// import { BatchForSessionType } from "@/schemas/student/student-list/institute-schema";

export const fetchLevel = (level: LevelField): InviteLevelType => {
    return {
        id: level.id,
        name: level.name,
        package_session_id: level.packageSessionId,
    };
};

export const fetchPreSelectedSessions = (session: PreSelectedSession): PreSelectedSessionType => {
    const preSelectedLevels =
        session.preSelectedLevels.length == 0
            ? []
            : session.preSelectedLevels.map((level) => fetchLevel(level));
    const learnerChoiceLevels =
        session.learnerChoiceLevels.length == 0
            ? []
            : session.learnerChoiceLevels.map((level) => fetchLevel(level));
    const preSelectedSessions: PreSelectedSessionType = {
        id: session.id,
        name: session.name,
        institute_assigned: preSelectedLevels.length == 0 ? false : true,
        max_selectable_levels:
            learnerChoiceLevels.length == 0 ? 0 : session.maxLevels == 0 ? 1 : session.maxLevels,
        pre_selected_levels: preSelectedLevels,
        learner_choice_levels: learnerChoiceLevels,
    };
    return preSelectedSessions;
};

export const fetchLearnerChoiceSessions = (
    session: LearnerChoiceSession
): LearnerChoiceSessionType => {
    const learnerChoiceLevels =
        session.learnerChoiceLevels.length == 0
            ? []
            : session.learnerChoiceLevels.map((level) => fetchLevel(level));
    const learnerChoiceSession: LearnerChoiceSessionType = {
        id: session.id,
        name: session.name,
        max_selectable_levels:
            session.learnerChoiceLevels.length == 0
                ? 0
                : session.maxLevels == 0
                  ? 1
                  : session.maxLevels,
        learner_choice_levels: learnerChoiceLevels,
    };
    return learnerChoiceSession;
};

export const fetchPreSelectedCourses = (course: PreSelectedCourse): PreSelectedPackagesType => {
    const preSelectedSessions =
        course.preSelectedSessions.length == 0
            ? []
            : course.preSelectedSessions.map((session) => fetchPreSelectedSessions(session));
    const learnerChoiceSessions =
        course.learnerChoiceSessions.length == 0
            ? []
            : course.learnerChoiceSessions.map((session) => fetchLearnerChoiceSessions(session));
    const preSelectedCourse: PreSelectedPackagesType = {
        id: course.id,
        name: course.name,
        institute_assigned: course.preSelectedSessions.length > 0 ? true : false,
        max_selectable_sessions:
            course.learnerChoiceSessions.length == 0
                ? 0
                : course.maxSessions == 0
                  ? 1
                  : course.maxSessions,
        pre_selected_session_dtos: preSelectedSessions,
        learner_choice_sessions: learnerChoiceSessions,
    };
    return preSelectedCourse;
};

export const fetchLearnerChoiceCourses = (
    course: LearnerChoiceCourse
): LearnerChoicePackagesType => {
    const learnerChoiceSessions =
        course.learnerChoiceSessions.length == 0
            ? []
            : course.learnerChoiceSessions.map((session) => fetchLearnerChoiceSessions(session));
    const learnerChoiceCourse: LearnerChoicePackagesType = {
        id: course.id,
        name: course.name,
        max_selectable_sessions:
            course.learnerChoiceSessions.length == 0
                ? 0
                : course.maxSessions == 0
                  ? 1
                  : course.maxSessions,
        learner_choice_sessions: learnerChoiceSessions,
    };
    return learnerChoiceCourse;
};

export const fetchBatchOptions = (data: InviteForm): string => {
    // const preSelectedCoures = data.batches.preSelectedCourses.map((course) =>
    //     fetchPreSelectedCourses(course),
    // );
    // const learnerChoiceCourses = data.batches.learnerChoiceCourses.map((course) =>
    //     fetchLearnerChoiceCourses(course),
    // );

    // const preSelectedCoures = [];
    // const learnerChoiceCourses = [];

    const batchOptionsJson: BatchOptionJsonType = {
        institute_assigned: data.batches.preSelectedCourses.length > 0 ? true : false,
        max_selectable_packages:
            data.batches.learnerChoiceCourses.length == 0
                ? 0
                : data.batches.maxCourses == 0
                  ? 1
                  : data.batches.maxCourses,
        pre_selected_packages: [],
        learner_choice_packages: [],
    };
    return JSON.stringify(batchOptionsJson);
};

export const fetchCustomFields = (data: InviteForm): CustomFieldType[] => {
    const customFields: CustomFieldType[] =
        data.custom_fields?.map((field) => ({
            id: field.id.toString(),
            field_name: field.name,
            field_type: field.type == 'dropdown' ? 'DROPDOWN' : 'TEXT',
            default_value: null,
            description: '',
            is_mandatory: field.isRequired,
            comma_separated_options: field.options?.map((option) => option.value).join(',') || '',
        })) || [];
    return customFields;
};

export default function formDataToRequestData(
    data: InviteForm,
    getPackageSessionId: (params: {
        courseId: string;
        sessionId: string;
        levelId: string;
    }) => string | null,
    id?: string
): CreateInvitationRequestType {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const customFields = fetchCustomFields(data);
    const batches =
        data.batches.courseSelectionMode === 'institute'
            ? data.batches.preSelectedCourses
            : data.batches.learnerChoiceCourses;
    const batchOptionJson = createBatchOptions(
        batches,
        data.batches.courseSelectionMode,
        data.batches.maxCourses,
        getPackageSessionId
    );

    const request: CreateInvitationRequestType = {
        emails_to_send_invitation: data.inviteeEmails?.map((emailObj) => emailObj.value) || [],
        learner_invitation: {
            id: id ? id : null,
            name: data.inviteLink,
            status: data.activeStatus ? 'ACTIVE' : 'INACTIVE',
            date_generated: null,
            expiry_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
            institute_id: INSTITUTE_ID || '',
            invite_code: null,
            batch_options_json: JSON.stringify(batchOptionJson),
            custom_fields: customFields,
        },
    };
    return request;
}
