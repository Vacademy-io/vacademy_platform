import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';

/**
 * Uploads images from HTML and CSS to S3 and replaces their URLs
 * Handles base64 images, external URLs, and background images
 */
export const uploadImagesToS3 = async (
    html: string,
    css?: string
): Promise<{ html: string; css: string }> => {
    const userId = getUserId();
    const instituteId = getInstituteId();

    if (!userId || !instituteId) {
        console.error('Missing user credentials for image upload');
        toast.error('Unable to upload images. Please refresh and try again.');
        return { html, css: css || '' };
    }

    let processedCss = css || '';

    // Create temporary DOM to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Find all base64 images in img tags
    const allImages = tempDiv.querySelectorAll('img');
    const images: Element[] = [];
    allImages.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('data:')) {
            images.push(img);
        }
    });

    // Find all elements with background-image styles
    const allElements = tempDiv.querySelectorAll('*');
    const elementsWithBgImages: Array<{ element: Element; bgImage: string }> = [];

    // Helper to extract background-image URL
    const extractBgImageUrl = (styleString: string): string | null => {
        const patterns = [
            /background-image:\s*url\(['"]?([^'"]+)['"]?\)/i,
            /background:\s*[^;]*url\(['"]?([^'"]+)['"]?\)/i,
        ];

        for (const pattern of patterns) {
            const match = styleString.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    };

    allElements.forEach((element) => {
        const el = element as HTMLElement;
        const style = el.getAttribute('style') || '';
        const bgUrl = extractBgImageUrl(style);

        if (bgUrl && bgUrl.startsWith('data:')) {
            elementsWithBgImages.push({ element: el, bgImage: bgUrl });
        }
    });

    // Find background images in CSS
    const cssBgImages: Array<{ bgImage: string }> = [];
    if (processedCss) {
        const directBgImageRegex = /background(?:-image)?:\s*[^;]*url\(['"]?([^'"]+)['"]?\)/gi;
        let match: RegExpExecArray | null;
        while ((match = directBgImageRegex.exec(processedCss)) !== null) {
            if (match[1] && match[1].startsWith('data:')) {
                const exists = cssBgImages.some((item) => item.bgImage === match![1]);
                if (!exists) {
                    cssBgImages.push({ bgImage: match[1] });
                }
            }
        }
    }

    const totalImages = images.length + elementsWithBgImages.length + cssBgImages.length;

    if (totalImages === 0) {
        return { html, css: processedCss };
    }

    console.log(`Found ${totalImages} images to upload to S3`);

    const imagePromises: Promise<void>[] = [];
    let uploadedCount = 0;
    let failedCount = 0;

    // Helper to convert base64 to File
    const base64ToFile = (base64Data: string, mimeType: string, filename: string): File | null => {
        try {
            const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            if (!base64String) throw new Error('Invalid base64 data');

            const binaryString = atob(base64String);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mimeType });
            return new File([blob], filename, { type: mimeType });
        } catch (error) {
            console.error('Error converting base64 to File:', error);
            return null;
        }
    };

    // Helper to upload a single image
    const uploadImageToS3 = async (originalSrc: string): Promise<string | null> => {
        try {
            const match = originalSrc.match(/data:([^;]+);base64,(.+)/);
            if (!match || !match[1] || !match[2]) {
                console.error('Invalid base64 format');
                return null;
            }

            const mimeType = match[1];
            const extension = mimeType.split('/')[1] || 'png';
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const filename = `template-image-${timestamp}-${randomId}.${extension}`;

            const file = base64ToFile(match[2], mimeType, filename);
            if (!file) return null;

            // Upload to S3
            const fileId = await UploadFileInS3(
                file,
                () => { },
                userId,
                instituteId,
                'ADMIN',
                true
            );

            if (!fileId) throw new Error('Failed to upload to S3');

            const publicUrl = await getPublicUrl(fileId);
            if (!publicUrl) throw new Error('Failed to get public URL');

            return publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        }
    };

    // Process img tags
    images.forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) return;

        const promise = uploadImageToS3(src).then((s3Url) => {
            if (s3Url) {
                img.setAttribute('src', s3Url);
                uploadedCount++;
            } else {
                failedCount++;
            }
        });

        imagePromises.push(promise);
    });

    // Process inline background images
    elementsWithBgImages.forEach(({ element, bgImage }) => {
        const promise = uploadImageToS3(bgImage).then((s3Url) => {
            if (s3Url) {
                const currentStyle = element.getAttribute('style') || '';
                const updatedStyle = currentStyle.replace(
                    /background-image:\s*url\(['"]?[^'"]+['"]?\)/gi,
                    `background-image: url('${s3Url}')`
                );
                element.setAttribute('style', updatedStyle);
                uploadedCount++;
            } else {
                failedCount++;
            }
        });

        imagePromises.push(promise);
    });

    // Process CSS background images
    cssBgImages.forEach(({ bgImage }) => {
        const promise = uploadImageToS3(bgImage).then((s3Url) => {
            if (s3Url) {
                // Simple string replacement for CSS
                processedCss = processedCss.split(bgImage).join(s3Url);
                uploadedCount++;
            } else {
                failedCount++;
            }
        });

        imagePromises.push(promise);
    });

    // Wait for all uploads with timeout
    try {
        await Promise.race([
            Promise.all(imagePromises),
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    console.warn('Image upload timeout');
                    resolve();
                }, 60000);
            }),
        ]);
    } catch (error) {
        console.warn('Some images failed to upload:', error);
    }

    if (uploadedCount > 0) {
        toast.success(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded to S3`);
    }
    if (failedCount > 0) {
        toast.warning(`${failedCount} image${failedCount > 1 ? 's' : ''} failed to upload`);
    }

    return { html: tempDiv.innerHTML, css: processedCss };
};
