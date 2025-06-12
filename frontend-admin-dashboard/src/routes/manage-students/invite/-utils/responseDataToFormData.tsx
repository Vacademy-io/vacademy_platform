import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { BatchDetails, CustomField, InviteForm } from '../-schema/InviteFormSchema';
import {
    BatchOptionJsonType,
    CustomFieldType,
    LearnerChoicePackagesType,
    LearnerInvitationType,
    PreSelectedPackagesType,
} from '../-types/create-invitation-types';

type GetDetailsFromPackageSessionId = (params: {
    packageSessionId: string;
}) => BatchForSessionType | null;

export const responseToFormCustomField = (responseCustomField: CustomFieldType): CustomField => {
    const options = responseCustomField.comma_separated_options.split(',');
    const requiredOptionsFormat = options.map((option, index) => ({
        id: index,
        value: option,
        disabled: false,
    }));
    const formCustomField: CustomField = {
        id: Math.floor(Math.random() * 100000),
        type: responseCustomField.field_type,
        name: responseCustomField.field_name,
        oldKey: true,
        isRequired: responseCustomField.is_mandatory,
        options: requiredOptionsFormat,
    };

    return formCustomField;
};

export const responseToFormPreSelectedCourses = (
    responsePreSelectedCourses: PreSelectedPackagesType[],
    getDetailsFromPackageSessionId: GetDetailsFromPackageSessionId
): BatchForSessionType[] => {
    const psIds: string[] = [];
    responsePreSelectedCourses.forEach((course) => {
        course.pre_selected_session_dtos.forEach((session) => {
            session.pre_selected_levels.forEach((level) => {
                if (level.package_session_id) {
                    psIds.push(level.package_session_id);
                }
            });
        });
    });

    const formPreSelectedCourses: BatchForSessionType[] = psIds
        .map((psId) => getDetailsFromPackageSessionId({ packageSessionId: psId }))
        .filter((item): item is BatchForSessionType => item !== null);

    return formPreSelectedCourses;
};

export const responseToFormLearnerChoiceCourses = (
    responseLearnerChoiceCourses: LearnerChoicePackagesType[],
    getDetailsFromPackageSessionId: GetDetailsFromPackageSessionId
): BatchForSessionType[] => {
    const psIds: string[] = [];
    responseLearnerChoiceCourses.forEach((course) => {
        course.learner_choice_sessions.forEach((session) => {
            session.learner_choice_levels.forEach((level) => {
                if (level.package_session_id) {
                    psIds.push(level.package_session_id);
                }
            });
        });
    });

    const formLearnerChoiceCourses: BatchForSessionType[] = psIds
        .map((psId) => getDetailsFromPackageSessionId({ packageSessionId: psId }))
        .filter((item): item is BatchForSessionType => item !== null);

    return formLearnerChoiceCourses;
};

export const responseToFormBatch = (
    responseBatch: BatchOptionJsonType,
    getDetailsFromPackageSessionId: GetDetailsFromPackageSessionId
): BatchDetails => {
    const formBatch: BatchDetails = {
        maxCourses: responseBatch.max_selectable_packages,
        courseSelectionMode: responseBatch.institute_assigned ? 'institute' : 'student',
        preSelectedCourses: responseToFormPreSelectedCourses(
            responseBatch.pre_selected_packages,
            getDetailsFromPackageSessionId
        ),
        learnerChoiceCourses: responseToFormLearnerChoiceCourses(
            responseBatch.learner_choice_packages,
            getDetailsFromPackageSessionId
        ),
    };
    return formBatch;
};

export default function responseDataToFormData(
    data: LearnerInvitationType,
    getDetailsFromPackageSessionId: GetDetailsFromPackageSessionId
): InviteForm {
    const responseBatch: BatchOptionJsonType = JSON.parse(data.batch_options_json);
    const formBatch = responseToFormBatch(responseBatch, getDetailsFromPackageSessionId);
    const CustomFields: CustomField[] = data.custom_fields.map((customField) =>
        responseToFormCustomField(customField)
    );

    // Convert expiry_date to Date format and calculate remaining days
    const expiryDate = new Date(data.expiry_date);
    const currentDate = new Date();
    const timeDifference = expiryDate.getTime() - currentDate.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDifference / (1000 * 60 * 60 * 24)));

    const formData: InviteForm = {
        inviteLink: data.name || '',
        activeStatus: data.status === 'ACTIVE',
        custom_fields: CustomFields,
        batches: formBatch,
        studentExpiryDays: daysRemaining,
        inviteeEmails: [{ id: '', value: 'abc@gmail.com' }],
        inviteeEmail: '',
    };

    return formData;
}
