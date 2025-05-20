// services/api/studentApi.ts
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { ENROLL_STUDENT_MANUALLY } from '@/constants/urls';
import { EnrollStudentRequest } from '@/types/students/type-enroll-student-manually';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const enrollStudent = async ({
    formData,
    packageSessionId,
}: EnrollStudentRequest): Promise<string> => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const requestBody = {
        user_details: {
            username: formData.stepFiveData?.username || '',
            email: formData.stepThreeData?.email || '',
            full_name: formData.stepTwoData?.fullName || '',
            address_line: formData.stepThreeData?.addressLine || '',
            city: formData.stepThreeData?.city || '',
            region: formData.stepThreeData?.state || '',
            pin_code: formData.stepThreeData?.pincode || '',
            mobile_number: formData.stepThreeData?.mobileNumber || '',
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
            parents_to_mother_mobile_number: formData.stepFourData?.motherMobileNumber || '',
            parents_to_mother_email: formData.stepFourData?.motherEmail || '',
        },
        institute_student_details: {
            institute_id: INSTITUTE_ID,
            package_session_id: packageSessionId,
            enrollment_id: formData.stepTwoData?.enrollmentNumber || '',
            enrollment_status: 'ACTIVE',
            enrollment_date: new Date().toISOString(),
            group_id: null,
            access_days: formData.stepTwoData?.accessDays,
        },
        status: true,
        status_message: '',
        error_message: '',
    };

    const response = await authenticatedAxiosInstance.post(ENROLL_STUDENT_MANUALLY, requestBody);
    return response.data;
};
