package vacademy.io.auth_service.feature.analytics.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.auth_service.config.CacheConfig;
import vacademy.io.common.auth.dto.UserActivityAnalyticsDto;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.UserActivityTrackingService;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/auth-service/v1/analytics")
public class UserActivityAnalyticsController {

    @Autowired
    private UserActivityTrackingService userActivityTrackingService;

    /**
     * Get comprehensive user activity analytics for an institute
     */
    @GetMapping("/user-activity")
    @Cacheable(value = CacheConfig.ANALYTICS_CACHE, key = "#instituteId")
    public ResponseEntity<UserActivityAnalyticsDto> getUserActivityAnalytics(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(analytics);
    }

    /**
     * Get real-time active users count
     */
    @GetMapping("/active-users/real-time")
    @Cacheable(value = CacheConfig.ANALYTICS_REALTIME_CACHE, key = "#instituteId")
    public ResponseEntity<Long> getRealTimeActiveUsers(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic())
                .body(analytics.getCurrentlyActiveUsers());
    }

    /**
     * Get active users in different time ranges
     */
    @GetMapping("/active-users")
    @Cacheable(value = CacheConfig.ANALYTICS_ACTIVE_USERS_CACHE, key = "#instituteId")
    public ResponseEntity<ActiveUsersResponse> getActiveUsers(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);
        ActiveUsersResponse response = ActiveUsersResponse.builder()
                .currentlyActive(analytics.getCurrentlyActiveUsers())
                .last5Minutes(analytics.getActiveUsersLast5Minutes())
                .lastHour(analytics.getActiveUsersLastHour())
                .last24Hours(analytics.getActiveUsersLast24Hours())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.MINUTES).cachePublic())
                .body(response);
    }

    /**
     * Get today's activity summary
     */
    @GetMapping("/activity/today")
    @Cacheable(value = CacheConfig.ANALYTICS_TODAY_CACHE, key = "#instituteId")
    public ResponseEntity<TodayActivityResponse> getTodayActivity(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);

        TodayActivityResponse response = TodayActivityResponse.builder()
                .uniqueActiveUsers(analytics.getTodayUniqueActiveUsers())
                .totalSessions(analytics.getTodayTotalSessions())
                .totalApiCalls(analytics.getTodayTotalApiCalls())
                .totalActivityTimeMinutes(analytics.getTodayTotalActivityTimeMinutes())
                .averageSessionDurationMinutes(analytics.getAverageSessionDurationMinutes())
                .peakActivityHour(analytics.getPeakActivityHour())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(2, TimeUnit.MINUTES).cachePublic())
                .body(response);
    }

    /**
     * Get service usage statistics
     */
    @GetMapping("/service-usage")
    @Cacheable(value = CacheConfig.ANALYTICS_SERVICE_USAGE_CACHE, key = "#instituteId")
    public ResponseEntity<ServiceUsageResponse> getServiceUsage(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);

        ServiceUsageResponse response = ServiceUsageResponse.builder()
                .mostUsedServices(analytics.getMostUsedServices())
                .serviceUsageStats(analytics.getServiceUsageStats())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(response);
    }

    /**
     * Get user engagement trends
     */
    @GetMapping("/engagement/trends")
    @Cacheable(value = CacheConfig.ANALYTICS_TRENDS_CACHE, key = "#instituteId")
    public ResponseEntity<EngagementTrendsResponse> getEngagementTrends(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);

        EngagementTrendsResponse response = EngagementTrendsResponse.builder()
                .dailyActivityTrend(analytics.getDailyActivityTrend())
                .deviceUsageStats(analytics.getDeviceUsageStats())
                .hourlyActivity(analytics.getHourlyActivity())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).cachePublic())
                .body(response);
    }

    /**
     * Get most active users
     */
    @GetMapping("/users/most-active")
    @Cacheable(value = CacheConfig.ANALYTICS_MOST_ACTIVE_USERS_CACHE, key = "#instituteId + ':' + #limit")
    public ResponseEntity<MostActiveUsersResponse> getMostActiveUsers(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "limit", defaultValue = "10") int limit,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);

        MostActiveUsersResponse response = MostActiveUsersResponse.builder()
                .mostActiveUsers(analytics.getMostActiveUsers().stream()
                        .limit(limit)
                        .toList())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(10, TimeUnit.MINUTES).cachePublic())
                .body(response);
    }

    /**
     * Get currently active users with detailed information
     */
    @GetMapping("/users/currently-active")
    @Cacheable(value = CacheConfig.ANALYTICS_CURRENTLY_ACTIVE_CACHE, key = "#instituteId")
    public ResponseEntity<CurrentlyActiveUsersResponse> getCurrentlyActiveUsers(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        UserActivityAnalyticsDto analytics = userActivityTrackingService.getInstituteAnalytics(instituteId);

        CurrentlyActiveUsersResponse response = CurrentlyActiveUsersResponse.builder()
                .totalActiveUsers(analytics.getCurrentlyActiveUsers())
                .activeUsersList(analytics.getCurrentlyActiveUsersList())
                .build();

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic())
                .body(response);
    }

    // Response DTOs
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ActiveUsersResponse {
        private Long currentlyActive;
        private Long last5Minutes;
        private Long lastHour;
        private Long last24Hours;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class TodayActivityResponse {
        private Long uniqueActiveUsers;
        private Long totalSessions;
        private Long totalApiCalls;
        private Long totalActivityTimeMinutes;
        private Double averageSessionDurationMinutes;
        private Integer peakActivityHour;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ServiceUsageResponse {
        private java.util.List<String> mostUsedServices;
        private java.util.List<UserActivityAnalyticsDto.ServiceUsageDto> serviceUsageStats;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class EngagementTrendsResponse {
        private java.util.List<UserActivityAnalyticsDto.DailyActivityTrendDto> dailyActivityTrend;
        private java.util.List<UserActivityAnalyticsDto.DeviceUsageDto> deviceUsageStats;
        private java.util.List<UserActivityAnalyticsDto.HourlyActivityDto> hourlyActivity;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MostActiveUsersResponse {
        private java.util.List<UserActivityAnalyticsDto.ActiveUserDto> mostActiveUsers;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CurrentlyActiveUsersResponse {
        private Long totalActiveUsers;
        private java.util.List<UserActivityAnalyticsDto.CurrentlyActiveUserDto> activeUsersList;
    }
}