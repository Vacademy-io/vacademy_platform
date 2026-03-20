import { getInstituteId } from '@/constants/helper';
import { ADD_EMAIL_ASSET, LIST_EMAIL_ASSETS } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Email Asset interface
export interface EmailAsset {
    id: string;
    name: string;
    data: string; // S3 URL
    thumbnail?: string;
    description?: string;
    folder_name: string;
    media_type: string;
    file_type: string;
    created_at_iso?: string;
    updated_at_iso?: string;
    created_by?: string;
    access_types?: string[];
}

// Response interface for list endpoint
interface ListEmailAssetsResponse {
    files: EmailAsset[];
}

// Get access token from cookies
const getAccessToken = (): string | null => {
    return getTokenFromCookie(TokenKey.accessToken);
};

/**
 * Add a new email asset to the system files
 */
export const addEmailAsset = async (
    s3Url: string,
    name: string,
    description: string = ''
): Promise<{ id: string }> => {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('Access token not found. Please login again.');
    }

    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found. Please login again.');
    }

    const response = await fetch(`${ADD_EMAIL_ASSET}?instituteId=${instituteId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            file_type: 'File',
            media_type: 'image',
            data: s3Url,
            name: name,
            folder_name: 'email-assets',
            description: description,
            view_access: [
                { level: 'institute', level_id: instituteId }
            ],
            edit_access: [
                { level: 'institute', level_id: instituteId }
            ]
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add email asset: ${response.status} ${errorText}`);
    }

    return await response.json();
};

/**
 * Get all email assets for the institute
 */
export const getEmailAssets = async (): Promise<EmailAsset[]> => {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('Access token not found. Please login again.');
    }

    const instituteId = getInstituteId();
    if (!instituteId) {
        throw new Error('Institute ID not found. Please login again.');
    }

    const response = await fetch(`${LIST_EMAIL_ASSETS}?instituteId=${instituteId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            level: 'institute',
            level_id: instituteId,
            access_type: 'view'
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get email assets: ${response.status} ${errorText}`);
    }

    const data: ListEmailAssetsResponse = await response.json();
    
    // Filter only email-assets folder
    const emailAssets = (data.files || []).filter(
        (file) => file.folder_name === 'email-assets'
    );

    return emailAssets;
};

/**
 * Delete an email asset (soft delete by removing from list)
 * Note: The API doesn't have a direct delete endpoint for system files,
 * so we'll need to handle this appropriately if needed
 */
export const deleteEmailAsset = async (assetId: string): Promise<void> => {
    // TODO: Implement if delete endpoint becomes available
    // For now, we don't have a delete endpoint in the provided API spec
    console.warn('Delete email asset not implemented yet. Asset ID:', assetId);
    throw new Error('Delete functionality is not available for email assets');
};

