import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EditStudentDetailsFormValues } from '../-components/students-list/student-side-view/student-overview/EditStudentDetails';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { EDIT_STUDENT_DETAILS } from '@/constants/urls';
import { toast } from 'sonner';
import { useStudentSidebar } from '../-context/selected-student-sidebar-context';

export const useEditStudentDetails = () => {
    const queryClient = useQueryClient();
    const { selectedStudent } = useStudentSidebar();
    return useMutation({
        mutationFn: (data: EditStudentDetailsFormValues) => {
            return authenticatedAxiosInstance.put(`${EDIT_STUDENT_DETAILS}`, data);
        },
        onSuccess: () => {
            toast.success('Student details updated successfully');
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({
                queryKey: ['GET_USER_CREDENTIALS', selectedStudent?.user_id || ''],
            });
        },
        onError: () => {
            toast.error('Failed to update student details');
        },
    });
};
