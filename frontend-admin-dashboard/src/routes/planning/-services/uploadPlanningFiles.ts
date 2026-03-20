import { UploadFileInS3 } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Uploads multiple files to S3 and returns comma-separated file IDs
 * @param files - Array of files to upload
 * @param setIsUploading - State setter for upload progress
 * @returns Promise with comma-separated file IDs
 */
export async function uploadPlanningFiles(
    files: File[],
    setIsUploading: Dispatch<SetStateAction<boolean>>
): Promise<string> {
    if (!files || files.length === 0) {
        return '';
    }

    const userId = getUserId();
    const fileIds: string[] = [];

    setIsUploading(true);

    try {
        // Upload files sequentially to avoid overwhelming the server
        for (const file of files) {
            const fileId = await UploadFileInS3(
                file,
                () => {}, // Individual file upload state not needed
                userId,
                'PLANNING_LOGS',
                'PLANNING'
            );

            if (fileId) {
                fileIds.push(fileId);
            }
        }

        return fileIds.join(',');
    } catch (error) {
        console.error('Error uploading planning files:', error);
        throw error;
    } finally {
        setIsUploading(false);
    }
}

/**
 * Uploads a single file to S3
 * @param file - File to upload
 * @param setIsUploading - State setter for upload progress
 * @returns Promise with file ID
 */
export async function uploadSinglePlanningFile(
    file: File,
    setIsUploading: Dispatch<SetStateAction<boolean>>
): Promise<string | undefined> {
    const userId = getUserId();

    return await UploadFileInS3(
        file,
        setIsUploading,
        userId,
        'PLANNING_LOGS',
        'PLANNING'
    );
}
