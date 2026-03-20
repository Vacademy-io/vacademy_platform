import { useState, useEffect, useRef } from 'react';

interface CachedImage {
    url: string;
    timestamp: number;
    loading: boolean;
}

interface ImageCache {
    [key: string]: CachedImage;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const useImageCache = () => {
    const [cache, setCache] = useState<ImageCache>({});
    const cacheRef = useRef<ImageCache>({});
    const cacheStableRef = useRef({
        getCachedUrl: (key: string): string | null => {
            const cached = cacheRef.current[key];
            if (!cached) return null;

            // Check if cache is still valid
            const now = Date.now();
            if (now - cached.timestamp > CACHE_DURATION) {
                return null;
            }

            return cached.url;
        },
        setCachedUrl: (key: string, url: string) => {
            setCache((prev) => ({
                ...prev,
                [key]: {
                    url,
                    timestamp: Date.now(),
                    loading: false,
                },
            }));
        },
        setLoading: (key: string, loading: boolean) => {
            setCache((prev) => ({
                ...prev,
                [key]: {
                    url: prev[key]?.url || '',
                    timestamp: prev[key]?.timestamp || Date.now(),
                    loading,
                },
            }));
        },
        isCached: (key: string): boolean => {
            const cached = cacheRef.current[key];
            if (!cached) return false;

            // Check if cache is still valid
            const now = Date.now();
            if (now - cached.timestamp > CACHE_DURATION) {
                return false;
            }

            return true;
        },
        isLoading: (key: string): boolean => {
            return cacheRef.current[key]?.loading || false;
        },
        clearCache: () => {
            setCache({});
        },
        removeFromCache: (key: string) => {
            setCache((prev) => {
                const newCache = { ...prev };
                delete newCache[key];
                return newCache;
            });
        },
    });

    // Keep cache ref in sync with state
    useEffect(() => {
        cacheRef.current = cache;
    }, [cache]);

    return cacheStableRef.current;
};
