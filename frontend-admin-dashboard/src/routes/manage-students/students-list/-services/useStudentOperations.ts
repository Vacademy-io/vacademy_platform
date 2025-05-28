// services/student-operations/useStudentOperations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { STUDENT_UPDATE_OPERATION } from '@/constants/urls';
import { useToast } from '@/hooks/use-toast';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface UpdateBatchRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
    newPackageSessionId: string;
}

const updateStudentBatch = async ({ students, newPackageSessionId }: UpdateBatchRequest) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.post(STUDENT_UPDATE_OPERATION, {
        operation: 'UPDATE_BATCH',
        requests: students.map(({ userId, currentPackageSessionId }) => ({
            user_id: userId,
            new_state: newPackageSessionId,
            institute_id: INSTITUTE_ID,
            current_package_session_id: currentPackageSessionId,
        })),
    });
    return response.data;
};

export const useUpdateBatchMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: updateStudentBatch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Batch updated successfully',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to update batch. Please try again.',
                variant: 'destructive',
            });
            console.error('Error updating batch:', error);
        },
    });
};

interface ExtendSessionRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
    newExpiryDate: string;
}

const extendStudentSession = async ({ students, newExpiryDate }: ExtendSessionRequest) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.post(STUDENT_UPDATE_OPERATION, {
        operation: 'ADD_EXPIRY',
        requests: students.map(({ userId, currentPackageSessionId }) => ({
            user_id: userId,
            new_state: newExpiryDate,
            institute_id: INSTITUTE_ID,
            current_package_session_id: currentPackageSessionId,
        })),
    });
    return response.data;
};

export const useExtendSessionMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: extendStudentSession,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Session extended successfully',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to extend session. Please try again.',
                variant: 'destructive',
            });
            console.error('Error extending session:', error);
        },
    });
};

interface TerminateStudentRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
}

const terminateStudent = async ({ students }: TerminateStudentRequest) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.post(STUDENT_UPDATE_OPERATION, {
        operation: 'MAKE_INACTIVE',
        requests: students.map(({ userId, currentPackageSessionId }) => ({
            user_id: userId,
            new_state: 'INACTIVE',
            institute_id: INSTITUTE_ID,
            current_package_session_id: currentPackageSessionId,
        })),
    });
    return response.data;
};

export const useTerminateStudentMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: terminateStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Student registration terminated successfully',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to terminate registration. Please try again.',
                variant: 'destructive',
            });
            console.error('Error terminating registration:', error);
        },
    });
};

interface DeleteStudentRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
}

const deleteStudent = async ({ students }: DeleteStudentRequest) => {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const response = await authenticatedAxiosInstance.post(STUDENT_UPDATE_OPERATION, {
        operation: 'TERMINATE',
        requests: students.map(({ userId, currentPackageSessionId }) => ({
            user_id: userId,
            new_state: 'TERMINATE',
            institute_id: INSTITUTE_ID,
            current_package_session_id: currentPackageSessionId,
        })),
    });
    return response.data;
};

export const useDeleteStudentMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Student deleted successfully',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to delete student. Please try again.',
                variant: 'destructive',
            });
            console.error('Error deleting student:', error);
        },
    });
};
