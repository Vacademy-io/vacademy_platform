import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    ADD_SYSTEM_FILE,
    GET_SYSTEM_FILES,
    GET_SYSTEM_FILES_ACCESS,
    UPDATE_SYSTEM_FILES_ACCESS,
    GET_MY_SYSTEM_FILES,
} from '@/constants/urls';
import { UploadFileInS3 } from './upload_file';
import { getUserId, getUserName } from '@/utils/userDetails';
import { AnnouncementService } from './announcement';
import { getUserRoleForInstitute } from '@/lib/auth/instituteUtils';

// ========================================
// Type Definitions
// ========================================

export type FileType = 'File' | 'Url' | 'Html';
export type MediaType = 'video' | 'audio' | 'pdf' | 'doc' | 'image' | 'note' | 'unknown';
export type AccessLevel = 'user' | 'batch' | 'role' | 'institute';
export type AccessType = 'view' | 'edit';
export type FileStatus = 'ACTIVE' | 'DELETED' | 'ARCHIVED';

export interface AccessPermission {
    level: AccessLevel;
    level_id: string;
}

export interface SystemFile {
    id: string;
    file_type: FileType;
    media_type: MediaType;
    data: string;
    name: string;
    folder_name?: string;
    thumbnail_file_id?: string;
    created_at_iso: string;
    updated_at_iso: string;
    created_by: string;
    status?: FileStatus; // Optional status field
    access_types?: AccessType[];
}

export interface FileAccessDetail extends SystemFile {
    status: FileStatus;
    created_by_user_id: string;
    access_list: AccessRecord[];
}

export interface AccessRecord {
    id: string;
    access_type: AccessType;
    level: AccessLevel;
    level_id: string;
    is_creator: boolean;
    created_at_iso: string;
}

// Request Interfaces
export interface AddSystemFileRequest {
    file_type: FileType;
    media_type: MediaType;
    data: string;
    name: string;
    folder_name?: string;
    thumbnail_file_id?: string;
    view_access?: AccessPermission[];
    edit_access?: AccessPermission[];
}

export interface ListSystemFilesRequest {
    level: AccessLevel;
    level_id: string;
    access_type?: AccessType;
}

export interface GetMyFilesRequest {
    user_roles?: string[];
    access_type?: AccessType;
    statuses?: FileStatus[];
}

export interface UpdateFileAccessRequest {
    system_file_id: string;
    user_roles?: string[];
    status?: FileStatus;
    view_access?: AccessPermission[];
    edit_access?: AccessPermission[];
}

// Response Interfaces
export interface AddSystemFileResponse {
    id: string;
}

export interface ListSystemFilesResponse {
    files: SystemFile[];
}

export interface GetMyFilesResponse {
    files: SystemFile[];
}

export interface UpdateFileAccessResponse {
    success: boolean;
    message: string;
    updated_access_count: number;
}

// ========================================
// Core API Functions
// ========================================

/**
 * Add a new system file
 * @param instituteId - Institute ID
 * @param fileData - File data including type, media type, name, access permissions, etc.
 * @returns Object with file ID
 */
export const addSystemFile = async (
    instituteId: string,
    fileData: AddSystemFileRequest
): Promise<AddSystemFileResponse> => {
    try {
        const response = await authenticatedAxiosInstance.post(
            `${ADD_SYSTEM_FILE}?instituteId=${instituteId}`,
            fileData
        );
        return response.data;
    } catch (error) {
        console.error('Error adding system file:', error);
        throw error;
    }
};

/**
 * List system files by access level
 * @param instituteId - Institute ID
 * @param requestData - Access level, level ID, and optional access type filter
 * @returns List of files
 */
export const listSystemFilesByAccess = async (
    instituteId: string,
    requestData: ListSystemFilesRequest
): Promise<ListSystemFilesResponse> => {
    try {
        console.log('listSystemFilesByAccess requestData:', requestData);
        const response = await authenticatedAxiosInstance({
            method: 'POST',
            url: `${GET_SYSTEM_FILES}?instituteId=${instituteId}`,
            data: requestData,
        });
        return response.data;
    } catch (error) {
        console.error('Error listing system files:', error);
        throw error;
    }
};

/**
 * Get all files accessible to the current user
 * @param instituteId - Institute ID
 * @param requestData - Optional user roles, access type, and status filters
 * @returns List of files accessible to user
 */
export const getMyFiles = async (
    instituteId: string,
    requestData?: GetMyFilesRequest
): Promise<GetMyFilesResponse> => {
    try {
        const response = await authenticatedAxiosInstance.post(
            `${GET_MY_SYSTEM_FILES}?instituteId=${instituteId}`,
            {
                data: requestData || {},
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error getting my files:', error);
        throw error;
    }
};

/**
 * Get detailed access information for a specific file
 * @param systemFileId - System file ID
 * @param instituteId - Institute ID
 * @returns File details with access list
 */
export const getFileAccessDetails = async (
    systemFileId: string,
    instituteId: string
): Promise<FileAccessDetail> => {
    try {
        const response = await authenticatedAxiosInstance.get(
            `${GET_SYSTEM_FILES_ACCESS}?systemFileId=${systemFileId}&instituteId=${instituteId}`
        );
        return response.data;
    } catch (error) {
        console.error('Error getting file access details:', error);
        throw error;
    }
};

/**
 * Update file access permissions and/or status
 * @param instituteId - Institute ID
 * @param updateData - File ID, optional status, and access permissions
 * @returns Update result
 */
export const updateFileAccess = async (
    instituteId: string,
    updateData: UpdateFileAccessRequest
): Promise<UpdateFileAccessResponse> => {
    try {
        const response = await authenticatedAxiosInstance.put(
            `${UPDATE_SYSTEM_FILES_ACCESS}?instituteId=${instituteId}`,
            updateData
        );
        return response.data;
    } catch (error) {
        console.error('Error updating file access:', error);
        throw error;
    }
};

// ========================================
// Helper Functions for File Upload
// ========================================

/**
 * Upload a file to S3 and create a system file entry
 * @param file - File to upload
 * @param instituteId - Institute ID
 * @param userId - User ID
 * @param fileData - Additional file metadata (name, folder, media type, access permissions)
 * @param setIsUploading - Optional state setter for upload progress
 * @returns Created system file ID
 */
export const uploadAndCreateSystemFile = async (
    file: File,
    instituteId: string,
    fileData: {
        name: string;
        folder_name?: string;
        media_type: MediaType;
        view_access?: AccessPermission[];
        edit_access?: AccessPermission[];
        thumbnail_file_id?: string;
    },
    setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>
): Promise<string> => {
    try {
        // Upload file to S3
        const userId = getUserId();
        const fileId = await UploadFileInS3(
            file,
            setIsUploading,
            userId,
            'SYSTEM_FILES',
            instituteId,
            true // Get public URL
        );

        if (!fileId) {
            throw new Error('Failed to upload file to S3');
        }

        // Create system file entry
        const systemFileData: AddSystemFileRequest = {
            file_type: 'File',
            media_type: fileData.media_type,
            data: fileId, // Store fileId as data
            name: fileData.name,
            folder_name: fileData.folder_name,
            thumbnail_file_id: fileData.thumbnail_file_id,
            view_access: fileData.view_access,
            edit_access: fileData.edit_access,
        };

        const response = await addSystemFile(instituteId, systemFileData);
        return response.id;
    } catch (error) {
        console.error('Error uploading and creating system file:', error);
        throw error;
    }
};

/**
 * Create a URL-based system file (no S3 upload needed)
 * @param instituteId - Institute ID
 * @param fileData - File metadata including URL
 * @returns Created system file ID
 */
export const createUrlSystemFile = async (
    instituteId: string,
    fileData: {
        url: string;
        name: string;
        folder_name?: string;
        media_type: MediaType;
        view_access?: AccessPermission[];
        edit_access?: AccessPermission[];
        thumbnail_file_id?: string;
    }
): Promise<string> => {
    try {
        const systemFileData: AddSystemFileRequest = {
            file_type: 'Url',
            media_type: fileData.media_type,
            data: fileData.url,
            name: fileData.name,
            folder_name: fileData.folder_name,
            thumbnail_file_id: fileData.thumbnail_file_id,
            view_access: fileData.view_access,
            edit_access: fileData.edit_access,
        };

        const response = await addSystemFile(instituteId, systemFileData);
        return response.id;
    } catch (error) {
        console.error('Error creating URL system file:', error);
        throw error;
    }
};

/**
 * Create an HTML content system file for a student
 * @param instituteId - Institute ID
 * @param fileData - File metadata including HTML content
 * @param studentId - Optional student ID to send notification to
 * @returns Created system file ID
 */
export const createHtmlSystemFile = async (
    instituteId: string,
    fileData: {
        html: string;
        name: string;
        folder_name?: string;
        view_access?: AccessPermission[];
        edit_access?: AccessPermission[];
        thumbnail_file_id?: string;
    },
    studentId?: string
): Promise<string> => {
    try {
        const systemFileData: AddSystemFileRequest = {
            file_type: 'Html',
            media_type: 'note',
            data: fileData.html,
            name: fileData.name,
            folder_name: fileData.folder_name,
            thumbnail_file_id: fileData.thumbnail_file_id,
            view_access: fileData.view_access,
            edit_access: fileData.edit_access,
        };

        const response = await addSystemFile(instituteId, systemFileData);

        // Send notification if studentId is provided
        if (studentId) {
            await sendFileAddedNotification(studentId, instituteId);
        }

        return response.id;
    } catch (error) {
        console.error('Error creating HTML system file:', error);
        throw error;
    }
};

// ========================================
// Status Management Helper Functions
// ========================================

/**
 * Soft-delete a system file by setting status to DELETED
 * @param fileId - System file ID
 * @param instituteId - Institute ID
 * @param userRoles - Optional user roles for authorization
 * @returns Update result
 */
export const deleteSystemFile = async (
    fileId: string,
    instituteId: string,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            status: 'DELETED',
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error deleting system file:', error);
        throw error;
    }
};

/**
 * Archive a system file by setting status to ARCHIVED
 * @param fileId - System file ID
 * @param instituteId - Institute ID
 * @param userRoles - Optional user roles for authorization
 * @returns Update result
 */
export const archiveSystemFile = async (
    fileId: string,
    instituteId: string,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            status: 'ARCHIVED',
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error archiving system file:', error);
        throw error;
    }
};

/**
 * Restore a deleted or archived file to ACTIVE status
 * @param fileId - System file ID
 * @param instituteId - Institute ID
 * @param userRoles - Optional user roles for authorization
 * @returns Update result
 */
export const restoreSystemFile = async (
    fileId: string,
    instituteId: string,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            status: 'ACTIVE',
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error restoring system file:', error);
        throw error;
    }
};

// ========================================
// Access Management Helper Functions
// ========================================

/**
 * Grant access to a specific user
 * @param fileId - System file ID
 * @param userId - User ID to grant access to
 * @param accessType - Type of access ('view' or 'edit')
 * @param instituteId - Institute ID
 * @param userRoles - Optional current user roles for authorization
 * @returns Update result
 */
export const grantUserAccess = async (
    fileId: string,
    userId: string,
    accessType: AccessType,
    instituteId: string,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        // First, get current access details
        const currentFile = await getFileAccessDetails(fileId, instituteId);

        // Build new access arrays
        const currentViewAccess = currentFile.access_list
            .filter((a) => a.access_type === 'view')
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        const currentEditAccess = currentFile.access_list
            .filter((a) => a.access_type === 'edit')
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        const newPermission: AccessPermission = { level: 'user', level_id: userId };

        if (accessType === 'view') {
            // Check if already exists
            const exists = currentViewAccess.some((a) => a.level_id === userId);
            if (!exists) {
                currentViewAccess.push(newPermission);
            }
        } else {
            // Check if already exists
            const exists = currentEditAccess.some((a) => a.level_id === userId);
            if (!exists) {
                currentEditAccess.push(newPermission);
            }
        }

        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            view_access: currentViewAccess,
            edit_access: currentEditAccess,
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error granting user access:', error);
        throw error;
    }
};

/**
 * Revoke access from a specific user
 * @param fileId - System file ID
 * @param userId - User ID to revoke access from
 * @param accessType - Type of access to revoke ('view' or 'edit')
 * @param instituteId - Institute ID
 * @param userRoles - Optional current user roles for authorization
 * @returns Update result
 */
export const revokeUserAccess = async (
    fileId: string,
    userId: string,
    accessType: AccessType,
    instituteId: string,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        // First, get current access details
        const currentFile = await getFileAccessDetails(fileId, instituteId);

        // Build new access arrays (excluding the user to revoke)
        const currentViewAccess = currentFile.access_list
            .filter((a) => a.access_type === 'view')
            .filter((a) => !(accessType === 'view' && a.level === 'user' && a.level_id === userId))
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        const currentEditAccess = currentFile.access_list
            .filter((a) => a.access_type === 'edit')
            .filter((a) => !(accessType === 'edit' && a.level === 'user' && a.level_id === userId))
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            view_access: currentViewAccess,
            edit_access: currentEditAccess,
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error revoking user access:', error);
        throw error;
    }
};

/**
 * Make file accessible to entire institute
 * @param fileId - System file ID
 * @param instituteId - Institute ID
 * @param accessType - Type of access ('view' or 'edit')
 * @param userRoles - Optional current user roles for authorization
 * @returns Update result
 */
export const grantInstituteAccess = async (
    fileId: string,
    instituteId: string,
    accessType: AccessType,
    userRoles?: string[]
): Promise<UpdateFileAccessResponse> => {
    try {
        const currentFile = await getFileAccessDetails(fileId, instituteId);

        const currentViewAccess = currentFile.access_list
            .filter((a) => a.access_type === 'view')
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        const currentEditAccess = currentFile.access_list
            .filter((a) => a.access_type === 'edit')
            .map((a) => ({ level: a.level, level_id: a.level_id }));

        const institutePermission: AccessPermission = {
            level: 'institute',
            level_id: instituteId,
        };

        if (accessType === 'view') {
            const exists = currentViewAccess.some(
                (a) => a.level === 'institute' && a.level_id === instituteId
            );
            if (!exists) {
                currentViewAccess.push(institutePermission);
            }
        } else {
            const exists = currentEditAccess.some(
                (a) => a.level === 'institute' && a.level_id === instituteId
            );
            if (!exists) {
                currentEditAccess.push(institutePermission);
            }
        }

        return await updateFileAccess(instituteId, {
            system_file_id: fileId,
            view_access: currentViewAccess,
            edit_access: currentEditAccess,
            user_roles: userRoles,
        });
    } catch (error) {
        console.error('Error granting institute access:', error);
        throw error;
    }
};

// ========================================
// Student-Specific Helper Functions
// ========================================

/**
 * Send notification to student when a file is added
 * @param studentId - Student user ID
 * @param instituteId - Institute ID
 */
const sendFileAddedNotification = async (studentId: string, instituteId: string): Promise<void> => {
    try {
        const currentDate = new Date();
        const endOfDay = new Date(currentDate);
        endOfDay.setHours(23, 59, 59, 999);

        await AnnouncementService.create({
            title: 'File',
            content: {
                type: 'html',
                content: '<p>New file has been added</p>',
            },
            createdBy: getUserId(),
            createdByName: getUserName(),
            createdByRole: getUserRoleForInstitute(instituteId) || 'ADMIN',
            recipients: [
                {
                    recipientType: 'USER',
                    recipientId: studentId,
                    recipientName: '',
                },
            ],
            exclusions: [],
            modes: [
                {
                    modeType: 'SYSTEM_ALERT',
                    settings: {
                        priority: 'HIGH',
                        expiresAt: endOfDay.toISOString(),
                    },
                },
            ],
            mediums: [
                {
                    mediumType: 'PUSH_NOTIFICATION',
                    config: {
                        title: 'File',
                        body: 'New file has been added',
                    },
                },
            ],
            scheduling: {
                scheduleType: 'IMMEDIATE',
                timezone: 'Asia/Calcutta',
            },
            instituteId: instituteId,
        });
    } catch (error) {
        console.error('Error sending file notification:', error);
        // Don't throw - notification failure shouldn't block file creation
    }
};

/**
 * Add a file for a specific student (grants view access to that student)
 * @param file - File to upload (if file_type is 'File')
 * @param studentId - Student user ID
 * @param instituteId - Institute ID
 * @param currentUserId - Current user ID (for S3 upload)
 * @param fileData - File metadata
 * @param setIsUploading - Optional state setter for upload progress
 * @returns Created system file ID
 */
export const addFileForStudent = async (
    file: File | null,
    studentId: string,
    instituteId: string,
    fileData: {
        name: string;
        folder_name?: string;
        media_type: MediaType;
        url?: string; // For URL-based files
        file_type?: FileType; // Default is 'File' if not provided
    },
    setIsUploading?: React.Dispatch<React.SetStateAction<boolean>>
): Promise<string> => {
    try {
        const studentAccess: AccessPermission = {
            level: 'user',
            level_id: studentId,
        };
        const adminAccess: AccessPermission = {
            level: 'role',
            level_id: 'Admin',
        };

        const fileType = fileData.file_type || 'File';
        let fileId: string;

        if (fileType === 'File' && file) {
            // Upload file and create system file
            fileId = await uploadAndCreateSystemFile(
                file,
                instituteId,
                {
                    name: fileData.name,
                    folder_name: fileData.folder_name,
                    media_type: fileData.media_type,
                    view_access: [studentAccess],
                    edit_access: [adminAccess], // all admins have edit access by default
                },
                setIsUploading
            );
        } else if (fileType === 'Url' && fileData.url) {
            // Create URL-based system file
            fileId = await createUrlSystemFile(instituteId, {
                url: fileData.url,
                name: fileData.name,
                folder_name: fileData.folder_name,
                media_type: fileData.media_type,
                view_access: [studentAccess],
                edit_access: [adminAccess],
            });
        } else {
            throw new Error('Invalid file type or missing file/URL');
        }

        // Send notification to student
        await sendFileAddedNotification(studentId, instituteId);

        return fileId;
    } catch (error) {
        console.error('Error adding file for student:', error);
        throw error;
    }
};

/**
 * Get all files for a specific student
 * @param studentId - Student user ID
 * @param instituteId - Institute ID
 * @param accessType - Optional filter by access type
 * @returns List of files accessible to the student
 */
export const getStudentFiles = async (
    studentId: string,
    instituteId: string,
    accessType?: AccessType
): Promise<SystemFile[]> => {
    try {
        const response = await listSystemFilesByAccess(instituteId, {
            level: 'user',
            level_id: studentId,
            access_type: accessType,
        });
        return response.files;
    } catch (error) {
        console.error('Error getting student files:', error);
        throw error;
    }
};

// ========================================
// Validation Helper Functions
// ========================================

/**
 * Validate file type enum
 */
export const isValidFileType = (fileType: string): fileType is FileType => {
    return ['File', 'Url', 'Html'].includes(fileType);
};

/**
 * Validate media type enum
 */
export const isValidMediaType = (mediaType: string): mediaType is MediaType => {
    return ['video', 'audio', 'pdf', 'doc', 'image', 'note', 'unknown'].includes(mediaType);
};

/**
 * Validate access level enum
 */
export const isValidAccessLevel = (level: string): level is AccessLevel => {
    return ['user', 'batch', 'role', 'institute'].includes(level);
};

/**
 * Validate access type enum
 */
export const isValidAccessType = (accessType: string): accessType is AccessType => {
    return ['view', 'edit'].includes(accessType);
};

/**
 * Validate file status enum
 */
export const isValidFileStatus = (status: string): status is FileStatus => {
    return ['ACTIVE', 'DELETED', 'ARCHIVED'].includes(status);
};

/**
 * Detect media type from file
 */
export const detectMediaTypeFromFile = (file: File): MediaType => {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (mimeType.startsWith('video/') || /\.(mp4|avi|mov|wmv|flv|webm)$/.test(fileName)) {
        return 'video';
    }
    if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(fileName)) {
        return 'audio';
    }
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return 'pdf';
    }
    if (
        mimeType.includes('document') ||
        mimeType.includes('msword') ||
        /\.(doc|docx|txt|rtf)$/.test(fileName)
    ) {
        return 'doc';
    }
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/.test(fileName)) {
        return 'image';
    }

    return 'unknown';
};
