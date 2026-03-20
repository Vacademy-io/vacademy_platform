/**
 * Simple in-memory cache for template variables
 */

import { CachedVariable, VariableCache, ResolvedVariable } from './types';

export class InMemoryVariableCache implements VariableCache {
    private cache = new Map<string, CachedVariable>();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

    get(key: string): CachedVariable | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cached;
    }

    set(key: string, variable: ResolvedVariable, ttl: number = this.defaultTTL): void {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, {
            variable: {
                ...variable,
                cached: true,
                timestamp: Date.now()
            },
            expiresAt
        });
    }

    clear(): void {
        this.cache.clear();
    }

    clearExpired(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    has(key: string): boolean {
        const cached = this.get(key);
        return cached !== null;
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        const total = this.cache.size;
        const expired = Array.from(this.cache.values()).filter(c => now > c.expiresAt).length;
        const active = total - expired;

        return {
            total,
            active,
            expired,
            hitRate: 0 // Could be implemented with hit/miss tracking
        };
    }

    /**
     * Create cache key for a variable
     */
    static createKey(variableName: string, context?: any): string {
        const contextStr = context ? JSON.stringify(context) : 'default';
        return `${variableName}:${contextStr}`;
    }
}

// Singleton cache instance
export const variableCache = new InMemoryVariableCache();
