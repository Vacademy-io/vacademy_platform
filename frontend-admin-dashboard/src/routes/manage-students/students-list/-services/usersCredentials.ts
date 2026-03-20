import { USERS_CREDENTIALS } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { StudentCredentialsType } from '@/services/student-list-section/getStudentCredentails';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { useMutation } from '@tanstack/react-query';

export const useUsersCredentials = () => {
    const { setCredentials } = useStudentCredentialsStore();
    return useMutation({
        mutationFn: async ({
            userIds,
        }: {
            userIds: string[];
        }): Promise<StudentCredentialsType[]> => {
            const response = await authenticatedAxiosInstance.post(`${USERS_CREDENTIALS}`, userIds);
            return response.data;
        },
        onSuccess: (data) => {
            if (Array.isArray(data)) {
                data.forEach((credential) => {
                    if (credential && credential.user_id) {
                        setCredentials(credential.user_id, credential);
                    }
                });
            } else {
                console.error('Received non-array data from API:', data);
            }
        },
        onError: (error) => {
            console.error('Error fetching user credentials:', error);
        },
    });
};
