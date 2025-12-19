package vacademy.io.auth_service.feature.analytics.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.feature.analytics.service.AnalyticsCacheEvictionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.HashMap;
import java.util.Map;

/**
 * Controller for manual cache management and eviction
 * These endpoints should be restricted to admin users only
 */
@Slf4j
@RestController
@RequestMapping("/auth-service/v1/analytics/cache")
public class CacheManagementController {

    @Autowired
    private AnalyticsCacheEvictionService cacheEvictionService;

    /**
     * Evict all analytics caches for a specific institute
     */
    @DeleteMapping("/institute/{instituteId}")
    public ResponseEntity<Map<String, String>> evictInstituteCache(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        log.info("Manual cache eviction requested for institute: {} by user: {}",
                instituteId, user.getUsername());

        cacheEvictionService.evictInstituteAnalyticsCache(instituteId);

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Analytics cache evicted for institute: " + instituteId);
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Evict only real-time caches for a specific institute
     */
    @DeleteMapping("/institute/{instituteId}/realtime")
    public ResponseEntity<Map<String, String>> evictRealTimeCache(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        log.info("Real-time cache eviction requested for institute: {} by user: {}",
                instituteId, user.getUsername());

        cacheEvictionService.evictRealTimeCaches(instituteId);

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Real-time cache evicted for institute: " + instituteId);
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Evict today's activity cache for a specific institute
     */
    @DeleteMapping("/institute/{instituteId}/today")
    public ResponseEntity<Map<String, String>> evictTodayActivityCache(
            @PathVariable("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        log.info("Today's activity cache eviction requested for institute: {} by user: {}",
                instituteId, user.getUsername());

        cacheEvictionService.evictTodayActivityCache(instituteId);

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Today's activity cache evicted for institute: " + instituteId);
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Evict all analytics caches for all institutes
     * Use with caution - this clears ALL analytics caches
     */
    @DeleteMapping("/all")
    public ResponseEntity<Map<String, String>> evictAllCaches(
            @RequestAttribute("user") CustomUserDetails user) {

        log.warn("FULL cache eviction requested by user: {}", user.getUsername());

        cacheEvictionService.evictAllAnalyticsCaches();

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "All analytics caches evicted");
        response.put("warning", "This affects all institutes");
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Get cache statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, String>> getCacheStats(
            @RequestAttribute("user") CustomUserDetails user) {

        log.debug("Cache statistics requested by user: {}", user.getUsername());

        cacheEvictionService.logCacheStatistics();

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Cache statistics logged to application logs");
        response.put("note", "Check application logs for detailed statistics");
        response.put("timestamp", java.time.Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Health check for cache system
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getCacheHealth() {

        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("cacheType", "redis-with-caffeine-fallback");
        response.put("timestamp", java.time.Instant.now().toString());

        Map<String, String> caches = new HashMap<>();
        caches.put("analytics", "5 minutes TTL");
        caches.put("analytics:realtime", "30 seconds TTL");
        caches.put("analytics:active-users", "1 minute TTL");
        caches.put("analytics:today", "2 minutes TTL");
        caches.put("analytics:service-usage", "10 minutes TTL");
        caches.put("analytics:trends", "15 minutes TTL");
        caches.put("analytics:most-active-users", "10 minutes TTL");
        caches.put("analytics:currently-active", "30 seconds TTL");

        response.put("configuredCaches", caches);

        return ResponseEntity.ok(response);
    }
}
