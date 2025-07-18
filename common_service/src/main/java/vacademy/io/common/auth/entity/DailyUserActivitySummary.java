package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_user_activity_summary", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "institute_id", "activity_date"}))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DailyUserActivitySummary {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(name = "total_sessions")
    private Integer totalSessions = 0;

    @Column(name = "total_activity_time_minutes")
    private Long totalActivityTimeMinutes = 0L;

    @Column(name = "total_api_calls")
    private Integer totalApiCalls = 0;

    @Column(name = "unique_services_used")
    private Integer uniqueServicesUsed = 0;

    @Column(name = "first_activity_time")
    private LocalDateTime firstActivityTime;

    @Column(name = "last_activity_time")
    private LocalDateTime lastActivityTime;

    @Column(name = "services_used", length = 1000)
    private String servicesUsed; // Comma-separated list of services

    @Column(name = "device_types_used", length = 500)
    private String deviceTypesUsed; // Comma-separated list of device types

    @Column(name = "peak_activity_hour")
    private Integer peakActivityHour; // Hour of day with most activity (0-23)

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
} 