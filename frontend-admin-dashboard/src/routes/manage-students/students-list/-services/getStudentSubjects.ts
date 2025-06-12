import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_STUDENT_SUBJECT_PROGRESS } from '@/constants/urls';
import { useQuery } from '@tanstack/react-query';
import { StudentSubjectsDetailsTypes } from '@/routes/manage-students/students-list/-types/student-subjects-details-types';

export const fetchStudentSubjectsProgress = async (userId: string, packageSessionId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_STUDENT_SUBJECT_PROGRESS, {
        params: {
            userId: userId,
            packageSessionId: packageSessionId,
        },
    });
    return response.data;
};

export const useStudentSubjectsProgressQuery = ({
    userId,
    packageSessionId,
}: {
    userId: string;
    packageSessionId: string;
}) => {
    return useQuery<StudentSubjectsDetailsTypes | null>({
        queryKey: ['GET_STUDENT_SUBJECTS_PROGRESS', userId, packageSessionId],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(GET_STUDENT_SUBJECT_PROGRESS, {
                params: {
                    userId,
                    packageSessionId,
                },
            });
            return response.data;
        },
        staleTime: 3600000,
        enabled: !!userId && !!packageSessionId,
    });
};
