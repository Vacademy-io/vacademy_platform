package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserActivityAnalyticsDto {

    // Real-time metrics
    private Long currentlyActiveUsers;
    private Long activeUsersLast5Minutes;
    private Long activeUsersLastHour;
    private Long activeUsersLast24Hours;
    
    // Daily activity stats
    private Long todayTotalSessions;
    private Long todayTotalApiCalls;
    private Long todayTotalActivityTimeMinutes;
    private Long todayUniqueActiveUsers;
    
    // Engagement metrics
    private Double averageSessionDurationMinutes;
    private Integer peakActivityHour;
    private List<String> mostUsedServices;
    
    // Trends (last 7 days)
    private List<DailyActivityTrendDto> dailyActivityTrend;
    private List<ServiceUsageDto> serviceUsageStats;
    private List<DeviceUsageDto> deviceUsageStats;
    private List<ActiveUserDto> mostActiveUsers;
    
    // Peak hours data
    private List<HourlyActivityDto> hourlyActivity;
    
    // Currently active users with details
    private List<CurrentlyActiveUserDto> currentlyActiveUsersList;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DailyActivityTrendDto {
        private LocalDate date;
        private Long uniqueUsers;
        private Long totalSessions;
        private Long totalApiCalls;
        private Double averageSessionDuration;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ServiceUsageDto {
        private String serviceName;
        private Long usageCount;
        private Double averageResponseTime;
        private Long uniqueUsers;
        private List<ServiceUserDto> topUsers; // Top users for this service
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DeviceUsageDto {
        private String deviceType;
        private Long usageCount;
        private Long uniqueUsers;
        private List<DeviceUserDto> topUsers; // Top users for this device type
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ActiveUserDto {
        private String userId;
        private String username;
        private String fullName;
        private String email;
        private Long totalSessions;
        private Long totalActivityTimeMinutes;
        private Long totalApiCalls;
        private LocalDateTime lastActivity;
        private String currentStatus; // ONLINE, RECENTLY_ACTIVE, OFFLINE
        private List<String> frequentServices;
        private String preferredDeviceType;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class HourlyActivityDto {
        private Integer hour;
        private Long activityCount;
        private Long uniqueUsers;
        private List<HourlyActiveUserDto> topActiveUsers; // Top users in this hour
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CurrentlyActiveUserDto {
        private String userId;
        private String username;
        private String fullName;
        private String email;
        private LocalDateTime loginTime;
        private LocalDateTime lastActivity;
        private String currentService;
        private String deviceType;
        private String ipAddress;
        private Long sessionDurationMinutes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ServiceUserDto {
        private String userId;
        private String username;
        private String fullName;
        private String email;
        private Long usageCount;
        private LocalDateTime lastUsed;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DeviceUserDto {
        private String userId;
        private String username;
        private String fullName;
        private String email;
        private Long usageCount;
        private LocalDateTime lastUsed;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class HourlyActiveUserDto {
        private String userId;
        private String username;
        private String fullName;
        private String email;
        private Long activityCount;
    }
} 