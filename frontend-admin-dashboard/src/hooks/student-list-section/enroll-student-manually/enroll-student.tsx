// enroll-student.tsx
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ENROLL_STUDENT_MANUALLY } from '@/constants/urls';
import { useMutation } from '@tanstack/react-query';
import {
    StepOneData,
    StepTwoData,
    StepThreeData,
    StepFourData,
    StepFiveData,
} from '@/schemas/student/student-list/schema-enroll-students-manually';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getSelectedSubOrgId } from '@/lib/auth/facultyAccessUtils';
import { getCustomFieldSettingsFromCache } from '@/services/custom-field-settings';

interface EnrollStudentParams {
    formData: {
        stepOneData: StepOneData | null;
        stepTwoData: StepTwoData | null;
        stepThreeData: StepThreeData | null;
        stepFourData: StepFourData | null;
        stepFiveData: StepFiveData | null;
    };
    packageSessionId: string;
}

export const useEnrollStudent = () => {
    const INSTITUTE_ID = getCurrentInstituteId();

    return useMutation({
        mutationFn: async ({ formData }: EnrollStudentParams) => {
            const { stepTwoData, stepThreeData, stepFourData, stepFiveData } = formData;

            // Get custom field IDs from cache to distinguish system vs custom fields
            const customFieldSettings = getCustomFieldSettingsFromCache();
            const customFieldIds = new Set(
                customFieldSettings?.customFields?.map((cf) => cf.id) || []
            );

            // Build custom_field_values array (ONLY custom fields, NOT system fields)
            const customFieldValues = stepTwoData?.custom_fields
                ? Object.entries(stepTwoData.custom_fields)
                      .filter(([fieldId]) => customFieldIds.has(fieldId))
                      .map(([custom_field_id, value]) => ({
                          custom_field_id,
                          value,
                      }))
                : [];

            // Build payment_initiation_request
            const paymentInitiationRequest = {
                amount: parseFloat(stepFourData?.amount || '0'),
                currency: stepFourData?.currency || 'INR',
                manual_request: {
                    file_id: stepFourData?.file_id || undefined,
                    transaction_id: stepFourData?.transaction_id || undefined,
                },
            };

            // Build learner_extra_details object with parent/guardian fields
            const learnerExtraDetails = {
                fathers_name: stepTwoData?.fathers_name || undefined,
                mothers_name: stepTwoData?.mothers_name || undefined,
                parents_mobile_number: stepTwoData?.parents_mobile_number || undefined,
                parents_email: stepTwoData?.parents_email || undefined,
                parents_to_mother_mobile_number:
                    stepTwoData?.parents_to_mother_mobile_number || undefined,
                parents_to_mother_email: stepTwoData?.parents_to_mother_email || undefined,
                linked_institute_name: stepTwoData?.linked_institute_name || undefined,
            };

            // Build the new API payload structure matching guide.md EXACTLY
            const requestBody = {
                user: {
                    full_name: stepTwoData?.full_name || '',
                    email: stepTwoData?.email || '',
                    mobile_number: stepTwoData?.mobile_number || '',
                    username: stepFiveData?.username || '',
                    password: stepFiveData?.password || '',
                    gender: stepTwoData?.gender || undefined,
                    date_of_birth: stepTwoData?.date_of_birth || undefined,
                    roles: ['STUDENT'],
                },
                institute_id: INSTITUTE_ID,
                sub_org_id: getSelectedSubOrgId() || undefined,
                learner_package_session_enroll: {
                    package_session_ids: stepThreeData?.invite?.package_session_ids || [],
                    enroll_invite_id: stepThreeData?.invite?.id || '',
                    payment_option_id: stepThreeData?.invite?.payment_option_id || '',
                    plan_id: stepFourData?.plan_id || undefined,
                    payment_initiation_request: paymentInitiationRequest,
                    custom_field_values: customFieldValues,
                    learner_extra_details: learnerExtraDetails,
                },
            };

            const response = await authenticatedAxiosInstance.post(
                ENROLL_STUDENT_MANUALLY,
                requestBody
            );

            return response.data;
        },
    });
};
