import { getPublicUrl } from '@/services/upload_file';

interface ImageFetchResult {
    id: string;
    url: string;
}

export const fetchImageWithCache = async (
    fileId: string,
    imageId: string,
    cache: {
        getCachedUrl: (key: string) => string | null;
        setCachedUrl: (key: string, url: string) => void;
        setLoading: (key: string, loading: boolean) => void;
        isCached: (key: string) => boolean;
        isLoading: (key: string) => boolean;
    }
): Promise<ImageFetchResult> => {
    const cacheKey = `${imageId}_${fileId}`;

    // Check if already cached
    const cachedUrl = cache.getCachedUrl(cacheKey);
    if (cachedUrl) {
        return { id: imageId, url: cachedUrl };
    }

    if (cache.isLoading(cacheKey)) {
        return new Promise((resolve) => {
            const checkLoading = () => {
                if (!cache.isLoading(cacheKey)) {
                    const finalUrl = cache.getCachedUrl(cacheKey);
                    resolve({ id: imageId, url: finalUrl || '' });
                } else {
                    setTimeout(checkLoading, 100);
                }
            };
            checkLoading();
        });
    }

    cache.setLoading(cacheKey, true);

    try {
        const url = await getPublicUrl(fileId);

        cache.setCachedUrl(cacheKey, url);

        return { id: imageId, url };
    } catch (error) {
        console.error(`Error fetching image for ${imageId}:`, error);
        cache.setCachedUrl(cacheKey, '');
        return { id: imageId, url: '' };
    }
};

export const fetchMultipleImagesWithCache = async (
    images: Array<{ id: string; fileId: string }>,
    cache: {
        getCachedUrl: (key: string) => string | null;
        setCachedUrl: (key: string, url: string) => void;
        setLoading: (key: string, loading: boolean) => void;
        isCached: (key: string) => boolean;
        isLoading: (key: string) => boolean;
    }
): Promise<ImageFetchResult[]> => {
    const uncachedImages = images.filter((img) => !cache.isCached(`${img.id}_${img.fileId}`));

    const fetchPromises = uncachedImages.map((img) =>
        fetchImageWithCache(img.fileId, img.id, cache)
    );

    const cachedResults = images
        .filter((img) => cache.isCached(`${img.id}_${img.fileId}`))
        .map((img) => ({
            id: img.id,
            url: cache.getCachedUrl(`${img.id}_${img.fileId}`) || '',
        }));

    const fetchedResults = await Promise.all(fetchPromises);

    return [...cachedResults, ...fetchedResults];
};
