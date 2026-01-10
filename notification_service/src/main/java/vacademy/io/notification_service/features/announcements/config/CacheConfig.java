package vacademy.io.notification_service.features.announcements.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
@EnableRetry
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        SimpleCacheManager cacheManager = new SimpleCacheManager();

        // Existing caches (5 minutes TTL)
        CaffeineCache usersByRole = new CaffeineCache(
                "usersByRole",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(1000)
                        .recordStats()
                        .build());

        CaffeineCache usersById = new CaffeineCache(
                "usersById",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(1000)
                        .recordStats()
                        .build());

        CaffeineCache facultyByPackageSessions = new CaffeineCache(
                "facultyByPackageSessions",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(1000)
                        .recordStats()
                        .build());

        CaffeineCache studentsByPackageSessions = new CaffeineCache(
                "studentsByPackageSessions",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(1000)
                        .recordStats()
                        .build());

        CaffeineCache usersByTags = new CaffeineCache(
                "usersByTags",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(1000)
                        .recordStats()
                        .build());

        // User Details cache (5 minutes TTL) - for caching auth service calls
        CaffeineCache userDetails = new CaffeineCache(
                "userDetails",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(10_000)
                        .recordStats()
                        .build());

        // Analytics caches
        CaffeineCache outgoingTemplates = new CaffeineCache(
                "outgoingTemplates",
                Caffeine.newBuilder()
                        .expireAfterWrite(10, TimeUnit.MINUTES)
                        .maximumSize(100)
                        .recordStats()
                        .build());

        CaffeineCache dailyParticipation = new CaffeineCache(
                "dailyParticipation",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(500)
                        .recordStats()
                        .build());

        CaffeineCache engagementLeaderboard = new CaffeineCache(
                "engagementLeaderboard",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(500)
                        .recordStats()
                        .build());

        CaffeineCache completionCohort = new CaffeineCache(
                "completionCohort",
                Caffeine.newBuilder()
                        .expireAfterWrite(5, TimeUnit.MINUTES)
                        .maximumSize(500)
                        .recordStats()
                        .build());

        cacheManager.setCaches(java.util.List.of(
                usersByRole,
                usersById,
                facultyByPackageSessions,
                studentsByPackageSessions,
                usersByTags,
                userDetails,
                outgoingTemplates,
                dailyParticipation,
                engagementLeaderboard,
                completionCohort));

        return cacheManager;
    }
}