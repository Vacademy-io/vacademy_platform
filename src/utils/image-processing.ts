import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface Base64Image {
    dataUrl: string;
    mimeType: string;
    base64Data: string;
    originalSrc: string;
}

/**
 * Extracts all base64 images from HTML content
 */
export function extractBase64Images(html: string): Base64Image[] {
    const base64Images: Base64Image[] = [];
    const imgRegex = /<img[^>]+src="data:([^;]+);base64,([^"]+)"[^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
        const mimeType = match[1];
        const base64Data = match[2];

        if (!mimeType || !base64Data) {
            continue;
        }

        base64Images.push({
            dataUrl: `data:${mimeType};base64,${base64Data}`,
            mimeType,
            base64Data,
            originalSrc: `data:${mimeType};base64,${base64Data}`,
        });
    }

    return base64Images;
}

/**
 * Converts base64 string to File object
 */
function base64ToFile(base64Data: string, mimeType: string, filename: string): File {
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and file
    const blob = new Blob([bytes], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
}

/**
 * Uploads a base64 image to S3 and returns the public URL
 */
async function uploadBase64ImageToS3(
    base64Data: string,
    mimeType: string,
    userId: string,
    instituteId: string
): Promise<string | null> {
    try {
        // Generate unique filename
        const extension = mimeType.split('/')[1] || 'png';
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const filename = `doc-image-${timestamp}-${randomId}.${extension}`;

        // Convert to File object
        const file = base64ToFile(base64Data, mimeType, filename);

        // Upload to S3
        const fileId = await UploadFileInS3(
            file,
            () => {}, // Progress callback - not needed for this use case
            userId,
            instituteId,
            'ADMIN',
            true // Generate public URL
        );

        if (!fileId) {
            throw new Error('Failed to upload image to S3');
        }

        // Get public URL
        const publicUrl = await getPublicUrl(fileId);
        return publicUrl;
    } catch (error) {
        console.error('Error uploading base64 image to S3:', error);
        return null;
    }
}

/**
 * Processes HTML content by replacing all base64 images with S3 URLs
 */
export async function processHtmlImages(html: string): Promise<{
    processedHtml: string;
    uploadedImages: number;
    failedUploads: number;
}> {
    // Get user credentials for S3 upload
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const instituteId = tokenData && Object.keys(tokenData.authorities)[0];
    const userId = tokenData?.sub;

    if (!userId || !instituteId) {
        console.error('Missing user credentials for image upload');
        return {
            processedHtml: html,
            uploadedImages: 0,
            failedUploads: 0,
        };
    }

    // Extract all base64 images
    const base64Images = extractBase64Images(html);

    if (base64Images.length === 0) {
        // No base64 images found, return original HTML
        return {
            processedHtml: html,
            uploadedImages: 0,
            failedUploads: 0,
        };
    }

    console.log(`Found ${base64Images.length} base64 images to process`);

    let processedHtml = html;
    let uploadedImages = 0;
    let failedUploads = 0;

    // Upload images in parallel (max 5 concurrent) for better performance
    const CONCURRENCY = 5;
    const results: { originalSrc: string; publicUrl: string | null }[] = [];

    for (let i = 0; i < base64Images.length; i += CONCURRENCY) {
        const batch = base64Images.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
            batch.map(async (image) => {
                const publicUrl = await uploadBase64ImageToS3(
                    image.base64Data,
                    image.mimeType,
                    userId,
                    instituteId
                );
                return { originalSrc: image.originalSrc, publicUrl };
            })
        );

        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                failedUploads++;
                console.error('Error processing image:', result.reason);
            }
        }
    }

    // Apply replacements
    for (const { originalSrc, publicUrl } of results) {
        if (publicUrl) {
            processedHtml = processedHtml.replace(originalSrc, publicUrl);
            uploadedImages++;
        } else {
            failedUploads++;
        }
    }

    console.log(`Image processing complete: ${uploadedImages} uploaded, ${failedUploads} failed`);

    return {
        processedHtml,
        uploadedImages,
        failedUploads,
    };
}

/**
 * Utility function to check if HTML contains base64 images
 */
export function containsBase64Images(html: string): boolean {
    const base64ImageRegex = /<img[^>]+src="data:[^;]+;base64,[^"]+"[^>]*>/i;
    return base64ImageRegex.test(html);
}

/**
 * Get estimated size of base64 images in HTML (in bytes)
 */
export function getBase64ImagesSize(html: string): number {
    const base64Images = extractBase64Images(html);
    let totalSize = 0;

    for (const image of base64Images) {
        // Base64 encoding increases size by ~33%, so decode to get original size
        totalSize += (image.base64Data.length * 3) / 4;
    }

    return totalSize;
}
