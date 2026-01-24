package vacademy.io.admin_core_service.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Cache configuration for application-level caching.
 *
 * Currently configured caches:
 * - studyLibraryInit: Caches study library initialization data (TTL: 20
 * seconds)
 * - executionLogs: Caches workflow execution logs by execution ID (TTL: 5
 * minutes)
 * - nodeLogs: Caches workflow node logs by execution ID + node ID (TTL: 5
 * minutes)
 * - timeRangeLogs: Caches workflow logs by time range (TTL: 5 minutes)
 */
@Configuration
@EnableCaching
public class CacheConfiguration {

        /**
         * Configure Caffeine-based cache manager with per-cache TTLs.
         */
        @Bean
        public CacheManager cacheManager() {
                SimpleCacheManager cacheManager = new SimpleCacheManager();

                // 20s TTL caches (existing behavior)
                CaffeineCache studyLibraryInit = new CaffeineCache(
                                "studyLibraryInit",
                                caffeineCache20sBuilder().build());
                CaffeineCache facultyByPackageSessions = new CaffeineCache(
                                "facultyByPackageSessions",
                                caffeineCache20sBuilder().build());
                CaffeineCache studentsByPackageSessions = new CaffeineCache(
                                "studentsByPackageSessions",
                                caffeineCache20sBuilder().build());

                // 2 minutes TTL caches (new API-level caches)
                CaffeineCache instituteById = new CaffeineCache(
                                "instituteById",
                                caffeineCache2mBuilder().build());
                CaffeineCache openInstituteDetails = new CaffeineCache(
                                "openInstituteDetails",
                                caffeineCache2mBuilder().build());
                CaffeineCache openInstituteIdOrSubdomain = new CaffeineCache(
                                "openInstituteIdOrSubdomain",
                                caffeineCache2mBuilder().build());

                CaffeineCache instituteDashboard = new CaffeineCache(
                                "instituteDashboard",
                                caffeineCache2mBuilder().build());
                CaffeineCache learnerInstituteDetails = new CaffeineCache(
                                "learnerInstituteDetails",
                                caffeineCache2mBuilder().build());
                CaffeineCache learnerInstituteDetailsByIds = new CaffeineCache(
                                "learnerInstituteDetailsByIds",
                                caffeineCache2mBuilder().build());
                CaffeineCache learnerInfo = new CaffeineCache(
                                "learnerInfo",
                                caffeineCache2mBuilder().build());

                // System Files caches
                CaffeineCache systemFileAccess = new CaffeineCache(
                                "systemFileAccess",
                                caffeineCache5mBuilder().build());
                CaffeineCache systemFileList = new CaffeineCache(
                                "systemFileList",
                                caffeineCache3mBuilder().build());
                CaffeineCache myFiles = new CaffeineCache(
                                "myFiles",
                                caffeineCache1mBuilder().build()); // Planning Logs cache
                CaffeineCache planningLogsList = new CaffeineCache(
                                "planningLogsList",
                                caffeineCache1mBuilder().build()); // Membership Details cache (user plan subscription
                // details)
                CaffeineCache membershipDetails = new CaffeineCache(
                                "membershipDetails",
                                caffeineCache2mBuilder().build());

                // User Plan related caches
                CaffeineCache userPlanById = new CaffeineCache(
                                "userPlanById",
                                caffeineCache2mBuilder().build());
                CaffeineCache userPlansByUser = new CaffeineCache(
                                "userPlansByUser",
                                caffeineCache2mBuilder().build());
                CaffeineCache userPlanWithPaymentLogs = new CaffeineCache(
                                "userPlanWithPaymentLogs",
                                caffeineCache2mBuilder().build());

                // Workflow Execution Log caches (5 minutes TTL)
                CaffeineCache executionLogs = new CaffeineCache(
                                "executionLogs",
                                caffeineCache5mBuilder().build());
                CaffeineCache nodeLogs = new CaffeineCache(
                                "nodeLogs",
                                caffeineCache5mBuilder().build());
                CaffeineCache timeRangeLogs = new CaffeineCache(
                                "timeRangeLogs",
                                caffeineCache5mBuilder().build());

                // User Details cache (5 minutes TTL) - for caching auth service calls
                CaffeineCache userDetails = new CaffeineCache(
                                "userDetails",
                                caffeineCacheUserDetailsBuilder().build());

                // Live Session caches (2 minutes TTL) - for caching session data
                CaffeineCache liveAndUpcomingSessions = new CaffeineCache(
                                "liveAndUpcomingSessions",
                                caffeineCache2mBuilder().build());

                // Learner Dashboard cache (2 minutes TTL)
                CaffeineCache learnerDashboard = new CaffeineCache(
                                "learnerDashboard",
                                caffeineCache2mBuilder().build());

                cacheManager.setCaches(java.util.List.of(
                                studyLibraryInit,
                                facultyByPackageSessions,
                                studentsByPackageSessions,
                                instituteById,
                                openInstituteDetails,
                                openInstituteIdOrSubdomain,
                                instituteDashboard,
                                learnerInstituteDetails,
                                learnerInstituteDetailsByIds,
                                learnerInfo,
                                systemFileAccess,
                                systemFileList,
                                myFiles,
                                planningLogsList,
                                membershipDetails,
                                userPlanById,
                                userPlansByUser,
                                userPlanWithPaymentLogs,
                                executionLogs,
                                nodeLogs,
                                timeRangeLogs,
                                userDetails,
                                liveAndUpcomingSessions,
                                learnerDashboard));

                return cacheManager;
        }

        /**
         * 20-second TTL cache builder.
         */
        private Caffeine<Object, Object> caffeineCache20sBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(1000)
                                .expireAfterWrite(20, TimeUnit.SECONDS)
                                .recordStats();
        }

        /**
         * 1-minute TTL cache builder (for frequently changing data).
         */
        private Caffeine<Object, Object> caffeineCache1mBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(2000)
                                .expireAfterWrite(1, TimeUnit.MINUTES)
                                .recordStats();
        }

        /**
         * 2-minute TTL cache builder.
         */
        private Caffeine<Object, Object> caffeineCache2mBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(1000)
                                .expireAfterWrite(2, TimeUnit.MINUTES)
                                .recordStats();
        }

        /**
         * 3-minute TTL cache builder (for stable data).
         */
        private Caffeine<Object, Object> caffeineCache3mBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(500)
                                .expireAfterWrite(3, TimeUnit.MINUTES)
                                .recordStats();
        }

        /**
         * 5-minute TTL cache builder (for very stable data).
         */
        private Caffeine<Object, Object> caffeineCache5mBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(500)
                                .expireAfterWrite(5, TimeUnit.MINUTES)
                                .recordStats();
        }

        /**
         * 5-minute TTL cache builder for User Details (High volume).
         */
        private Caffeine<Object, Object> caffeineCacheUserDetailsBuilder() {
                return Caffeine.newBuilder()
                                .maximumSize(10000) // Support up to 10k active users in memory
                                .expireAfterWrite(5, TimeUnit.MINUTES)
                                .recordStats();
        }
}
