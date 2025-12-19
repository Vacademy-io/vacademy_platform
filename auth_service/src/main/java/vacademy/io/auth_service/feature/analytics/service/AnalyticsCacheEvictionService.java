package vacademy.io.auth_service.feature.analytics.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.config.CacheConfig;

/**
 * Service to manage cache eviction for analytics data
 */
@Slf4j
@Service
public class AnalyticsCacheEvictionService {

    @Autowired
    private CacheManager cacheManager;

    /**
     * Evict all analytics caches for a specific institute
     * Call this when institute data is updated
     */
    public void evictInstituteAnalyticsCache(String instituteId) {
        log.info("Evicting analytics cache for institute: {}", instituteId);

        try {
            // Evict from all analytics caches
            evictFromCache(CacheConfig.ANALYTICS_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_ACTIVE_USERS_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_TODAY_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_SERVICE_USAGE_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_TRENDS_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_MOST_ACTIVE_USERS_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE, instituteId);
            evictFromCache(CacheConfig.ANALYTICS_REALTIME_CACHE, instituteId);

            log.info("Successfully evicted analytics cache for institute: {}", instituteId);
        } catch (Exception e) {
            log.error("Error evicting analytics cache for institute: {}", instituteId, e);
        }
    }

    /**
     * Evict only real-time caches (for frequent updates)
     */
    @CacheEvict(value = {
            CacheConfig.ANALYTICS_REALTIME_CACHE,
            CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE
    }, key = "#instituteId")
    public void evictRealTimeCaches(String instituteId) {
        log.debug("Evicted real-time caches for institute: {}", instituteId);
    }

    /**
     * Evict today's activity cache (for daily updates)
     */
    @CacheEvict(value = CacheConfig.ANALYTICS_TODAY_CACHE, key = "#instituteId")
    public void evictTodayActivityCache(String instituteId) {
        log.debug("Evicted today's activity cache for institute: {}", instituteId);
    }

    /**
     * Evict all analytics caches for all institutes
     */
    @CacheEvict(value = {
            CacheConfig.ANALYTICS_CACHE,
            CacheConfig.ANALYTICS_ACTIVE_USERS_CACHE,
            CacheConfig.ANALYTICS_TODAY_CACHE,
            CacheConfig.ANALYTICS_SERVICE_USAGE_CACHE,
            CacheConfig.ANALYTICS_TRENDS_CACHE,
            CacheConfig.ANALYTICS_MOST_ACTIVE_USERS_CACHE,
            CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE,
            CacheConfig.ANALYTICS_REALTIME_CACHE
    }, allEntries = true)
    public void evictAllAnalyticsCaches() {
        log.info("Evicting all analytics caches");
    }

    /**
     * Scheduled task to evict real-time caches every 5 minutes
     * This ensures stale data doesn't persist due to low traffic
     */
    @Scheduled(cron = "0 */5 * * * *")
    @CacheEvict(value = {
            CacheConfig.ANALYTICS_REALTIME_CACHE,
            CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE
    }, allEntries = true)
    public void scheduledRealTimeCacheEviction() {
        log.debug("Scheduled eviction of real-time analytics caches");
    }

    /**
     * Scheduled task to evict today's activity cache every hour
     */
    @Scheduled(cron = "0 0 * * * *")
    @CacheEvict(value = CacheConfig.ANALYTICS_TODAY_CACHE, allEntries = true)
    public void scheduledTodayActivityCacheEviction() {
        log.debug("Scheduled eviction of today's activity cache");
    }

    /**
     * Scheduled task to evict all analytics caches at midnight
     * This ensures fresh data at the start of each day
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void scheduledDailyFullCacheEviction() {
        log.info("Scheduled daily eviction of all analytics caches");
        evictAllAnalyticsCaches();
    }

    /**
     * Helper method to evict from a specific cache
     */
    private void evictFromCache(String cacheName, String key) {
        try {
            var cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.evict(key);
                log.debug("Evicted key {} from cache {}", key, cacheName);
            }
        } catch (Exception e) {
            log.warn("Error evicting key {} from cache {}: {}", key, cacheName, e.getMessage());
        }
    }

    /**
     * Clear a specific cache entirely
     */
    public void clearCache(String cacheName) {
        try {
            var cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                cache.clear();
                log.info("Cleared cache: {}", cacheName);
            }
        } catch (Exception e) {
            log.error("Error clearing cache {}: {}", cacheName, e.getMessage());
        }
    }

    /**
     * Get cache statistics (if available)
     */
    public void logCacheStatistics() {
        log.info("Cache Statistics:");
        cacheManager.getCacheNames().forEach(cacheName -> {
            var cache = cacheManager.getCache(cacheName);
            if (cache != null) {
                log.info("  Cache: {} - Native Cache: {}", cacheName,
                        cache.getNativeCache().getClass().getSimpleName());
            }
        });
    }
}
