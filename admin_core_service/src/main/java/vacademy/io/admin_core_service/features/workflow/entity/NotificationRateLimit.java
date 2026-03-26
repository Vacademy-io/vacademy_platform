package vacademy.io.admin_core_service.features.workflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "notification_rate_limit")
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class NotificationRateLimit {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(nullable = false)
    private String channel; // EMAIL, WHATSAPP, SMS, PUSH

    @Column(name = "daily_limit", nullable = false)
    private Integer dailyLimit;

    @Column(name = "daily_used", nullable = false)
    private Integer dailyUsed;

    @Column(name = "reset_date", nullable = false)
    private LocalDate resetDate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
