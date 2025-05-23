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
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

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
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    return useMutation({
        mutationFn: async ({ formData, packageSessionId }: EnrollStudentParams) => {
            const requestBody = {
                user_details: {
                    username: formData.stepFiveData?.username || '',
                    email: formData.stepThreeData?.email || '',
                    full_name: formData.stepTwoData?.fullName || '',
                    address_line: 'N/A',
                    city: formData.stepThreeData?.city || '',
                    mobile_number: formData.stepThreeData?.mobileNumber || '',
                    // date_of_birth: formData.stepTwoData.dateOfBirth || "",
                    date_of_birth: '',
                    gender: formData.stepTwoData?.gender.name || '',
                    password: formData.stepFiveData?.password || '',
                    profile_pic_file_id: formData.stepOneData?.profilePicture || '',
                    roles: ['STUDENT'],
                    root_user: false,
                },
                student_extra_details: {
                    fathers_name: formData.stepFourData?.fatherName || '',
                    mothers_name: formData.stepFourData?.motherName || '',
                    parents_mobile_number: formData.stepFourData?.guardianMobileNumber || '',
                    parents_email: formData.stepFourData?.guardianEmail || '',
                    linked_institute_name: formData.stepTwoData?.collegeName || '',
                    parents_to_mother_mobile_number:
                        formData.stepFourData?.motherMobileNumber || '',
                    parents_to_mother_email: formData.stepFourData?.motherEmail || '',
                },
                institute_student_details: {
                    institute_id: INSTITUTE_ID,
                    package_session_id: packageSessionId,
                    enrollment_id: formData.stepTwoData?.enrollmentNumber || '',
                    enrollment_status: 'ACTIVE',
                    enrollment_date: new Date().toISOString(),
                    accessDays: formData.stepTwoData?.accessDays,
                    group_id: '',
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
