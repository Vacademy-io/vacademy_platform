import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { DELETE_COURSE } from '@/constants/urls';

export const useDeleteCourse = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (courseId: string) => {
            return authenticatedAxiosInstance.delete(`${DELETE_COURSE}`, { data: [courseId] });
        },
        onSuccess: () => {
            // Invalidate existing queries
            queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['GET_SESSION_DATA'] });
            queryClient.invalidateQueries({ queryKey: ['GET_BATCHES'] });

            // Invalidate course list queries used in CourseMaterial component
            queryClient.invalidateQueries({ queryKey: ['allCourses'] });
            queryClient.invalidateQueries({ queryKey: ['authoredCourses'] });
            queryClient.invalidateQueries({ queryKey: ['my-courses'] });
        },
    });
};
