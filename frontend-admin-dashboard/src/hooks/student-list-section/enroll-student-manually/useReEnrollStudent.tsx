import { useMutation, useQueryClient } from '@tanstack/react-query'; // 👈 new API call
import { EnrollStudentRequest } from '@/types/students/type-enroll-student-manually';
import { reEnrollStudent } from '@/services/student-list-section/re-enrollmanully';

export const useReEnrollStudent = () => {
    const queryClient = useQueryClient();

    return useMutation<string, Error, EnrollStudentRequest>({
        mutationFn: reEnrollStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });
};
