import { MessageTemplate } from '@/types/message-template-types';
import { getMessageTemplates } from './message-template-service';

// Template cache to avoid multiple API calls
class TemplateCacheService {
    private cache: Map<string, MessageTemplate[]> = new Map();
    private loadingPromises: Map<string, Promise<MessageTemplate[]>> = new Map();
    private lastFetch: Map<string, number> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    async getTemplates(type?: 'EMAIL' | 'WHATSAPP'): Promise<MessageTemplate[]> {
        const cacheKey = type || 'all';
        const now = Date.now();
        const lastFetchTime = this.lastFetch.get(cacheKey) || 0;

        // Return cached data if it's still fresh
        if (this.cache.has(cacheKey) && now - lastFetchTime < this.CACHE_DURATION) {
            return this.cache.get(cacheKey)!;
        }

        // If already loading, return the existing promise
        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey)!;
        }

        // Start loading
        const loadingPromise = this.loadTemplates(type);
        this.loadingPromises.set(cacheKey, loadingPromise);

        try {
            const templates = await loadingPromise;
            this.cache.set(cacheKey, templates);
            this.lastFetch.set(cacheKey, now);
            return templates;
        } finally {
            this.loadingPromises.delete(cacheKey);
        }
    }

    private async loadTemplates(type?: 'EMAIL' | 'WHATSAPP'): Promise<MessageTemplate[]> {
        try {
            const response = await getMessageTemplates(type);
            return response.templates;
        } catch (error) {
            console.error('Error loading templates:', error);
            throw error;
        }
    }

    // Clear cache for a specific type or all
    clearCache(type?: 'EMAIL' | 'WHATSAPP'): void {
        if (type) {
            const cacheKey = type;
            this.cache.delete(cacheKey);
            this.lastFetch.delete(cacheKey);
        } else {
            this.cache.clear();
            this.lastFetch.clear();
        }
    }

    // Clear all caches
    clearAllCache(): void {
        this.cache.clear();
        this.lastFetch.clear();
        this.loadingPromises.clear();
    }

    // Get cached templates without making API call
    getCachedTemplates(type?: 'EMAIL' | 'WHATSAPP'): MessageTemplate[] | null {
        const cacheKey = type || 'all';
        return this.cache.get(cacheKey) || null;
    }

    // Check if cache is fresh
    isCacheFresh(type?: 'EMAIL' | 'WHATSAPP'): boolean {
        const cacheKey = type || 'all';
        const now = Date.now();
        const lastFetchTime = this.lastFetch.get(cacheKey) || 0;
        return now - lastFetchTime < this.CACHE_DURATION;
    }
}

// Export singleton instance
export const templateCacheService = new TemplateCacheService();
