// services/student-operations/useBulkOperations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { STUDENT_UPDATE_OPERATION } from '@/constants/urls';
import { useToast } from '@/hooks/use-toast';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
// import { StudentTable } from "@/schemas/student/student-list/table-schema";

interface BulkUpdateBatchRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
    newPackageSessionId: string;
}

const bulkUpdateStudentBatch = async ({
    students,
    newPackageSessionId,
}: BulkUpdateBatchRequest) => {
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

export const useBulkUpdateBatchMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: bulkUpdateStudentBatch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Successfully updated batches for selected students',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to update batches. Please try again.',
                variant: 'destructive',
            });
            console.error('Error in bulk batch update:', error);
        },
    });
};

interface BulkExtendSessionRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
    newExpiryDate: string;
}

const bulkExtendStudentSession = async ({ students, newExpiryDate }: BulkExtendSessionRequest) => {
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

export const useBulkExtendSessionMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: bulkExtendStudentSession,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Successfully extended sessions for selected students',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to extend sessions. Please try again.',
                variant: 'destructive',
            });
            console.error('Error in bulk session extension:', error);
        },
    });
};

interface BulkTerminateRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
}

const bulkTerminateStudents = async ({ students }: BulkTerminateRequest) => {
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

export const useBulkTerminateStudentsMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: bulkTerminateStudents,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Successfully terminated registrations for selected students',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to terminate registrations. Please try again.',
                variant: 'destructive',
            });
            console.error('Error in bulk termination:', error);
        },
    });
};

interface BulkDeleteRequest {
    students: {
        userId: string;
        currentPackageSessionId: string;
    }[];
}

const bulkDeleteStudents = async ({ students }: BulkDeleteRequest) => {
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

export const useBulkDeleteStudentsMutation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: bulkDeleteStudents,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            toast({
                title: 'Success',
                description: 'Successfully deleted selected students',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: 'Failed to delete students. Please try again.',
                variant: 'destructive',
            });
            console.error('Error in bulk deletion:', error);
        },
    });
};
