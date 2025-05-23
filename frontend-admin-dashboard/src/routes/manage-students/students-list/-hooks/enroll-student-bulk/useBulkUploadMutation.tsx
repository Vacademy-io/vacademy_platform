import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import {
    CSVFormatConfig,
    SchemaFields,
} from '@/routes/manage-students/students-list/-types/bulk-upload-types';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { STUDENT_CSV_UPLOAD_URL } from '@/constants/urls';
import axios from 'axios';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

interface SubmitBulkUploadParams {
    data: SchemaFields[];
    instituteId: string;
    bulkUploadInitRequest: CSVFormatConfig;
    packageSessionId: string;
    notify: boolean;
}

// Define the mutation function separately
const submitBulkUploadData = async ({
    data,
    instituteId,
    bulkUploadInitRequest,
    packageSessionId,
    notify,
}: SubmitBulkUploadParams): Promise<string> => {
    // Create form data
    const formData = new FormData();

    // Add instituteId and bulkUploadInitRequest as form fields
    formData.append('instituteId', instituteId);
    formData.append('bulkUploadInitRequest', JSON.stringify(bulkUploadInitRequest));
    formData.append('packageSessionId', packageSessionId);
    formData.append('notify', notify.toString());
    // Convert data to CSV and append as file
    const csvContent = Papa.unparse(data);
    const csvFile = new File([csvContent], 'students.csv', { type: 'text/csv' });
    formData.append('file', csvFile);

    // Make API call
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: STUDENT_CSV_UPLOAD_URL,
        data: formData,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

export const useBulkUploadMutation = (
    options?: Omit<UseMutationOptions<string, Error, SubmitBulkUploadParams, unknown>, 'mutationFn'>
) => {
    return useMutation<string, Error, SubmitBulkUploadParams, unknown>({
        mutationFn: submitBulkUploadData,
        onSuccess: (data: string) => {
            toast.success('CSV uploaded successfully');
            if (options?.onSuccess) {
                options.onSuccess(data, {} as SubmitBulkUploadParams, {});
            }
            return data;
        },
        onError: (error: Error) => {
            if (axios.isAxiosError(error)) {
                console.error('Upload error details:', {
                    response: error.response?.data,
                    status: error.response?.status,
                    headers: error.response?.headers,
                });
                toast.error(error.response?.data?.message || 'Failed to upload students');
            } else {
                console.error('Unexpected error:', error);
                toast.error('An unexpected error occurred');
            }

            if (options?.onError) {
                options.onError(error, {} as SubmitBulkUploadParams, {});
            }
        },
        ...options,
    });
};
