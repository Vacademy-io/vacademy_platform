import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ENROLL_STUDENT_MANUALLY } from '@/constants/urls';
import {
    StepOneData,
    StepTwoData,
    StepThreeData,
    StepFourData,
    StepFiveData,
} from '@/schemas/student/student-list/schema-enroll-students-manually';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface ReEnrollStudentParams {
    formData: {
        stepOneData: StepOneData | null;
        stepTwoData: StepTwoData | null;
        stepThreeData: StepThreeData | null;
        stepFourData: StepFourData | null;
        stepFiveData: StepFiveData | null;
    };
    packageSessionId: string; // Keep for compatibility, though not used in new API
}

export const useReEnrollStudent = () => {
    const queryClient = useQueryClient();
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

    return useMutation<string, Error, ReEnrollStudentParams>({
        mutationFn: async ({ formData }) => {
            const { stepTwoData, stepThreeData, stepFourData, stepFiveData } = formData;

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
                learner_package_session_enroll: {
                    package_session_ids: stepThreeData?.invite?.package_session_ids || [],
                    enroll_invite_id: stepThreeData?.invite?.id || '',
                    payment_option_id: stepThreeData?.invite?.payment_option_id || '',
                    plan_id: stepFourData?.plan_id || undefined,
                    payment_initiation_request: paymentInitiationRequest,
                    start_date: stepThreeData?.start_date || new Date().toISOString(),
                },
                learner_extra_details: learnerExtraDetails,
            };

            const response = await authenticatedAxiosInstance.post(
                ENROLL_STUDENT_MANUALLY,
                requestBody
            );

            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });
};
