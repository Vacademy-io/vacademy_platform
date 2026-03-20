import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_STUDENT_SLIDE_PROGRESS } from '@/constants/urls';
import { useQuery } from '@tanstack/react-query';
import { SlideWithProgressType } from '@/routes/manage-students/students-list/-types/student-slides-progress-type';

export const fetchStudentSlidesProgress = async (userId: string, chapterId: string) => {
    const response = await authenticatedAxiosInstance.get(GET_STUDENT_SLIDE_PROGRESS, {
        params: {
            userId: userId,
            chapterId: chapterId,
        },
    });
    return response.data;
};

export const useStudentSlidesProgressQuery = ({
    userId,
    chapterId,
}: {
    userId: string;
    chapterId: string;
}) => {
    return useQuery<SlideWithProgressType | null>({
        queryKey: ['GET_STUDENT_SLIDES_PROGRESS', userId, chapterId],
        queryFn: async () => {
            const data = await fetchStudentSlidesProgress(userId, chapterId);
            return data;
        },
        staleTime: 3600000,
    });
};
