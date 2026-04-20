package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Builder
@Getter
@Setter
@Entity
@Table(name = "student_fee_adjustment_history")
public class StudentFeeAdjustmentHistory {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "student_fee_payment_id", nullable = false)
    private String studentFeePaymentId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "adjustment_type", nullable = false)
    private String adjustmentType;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "reason")
    private String reason;

    @Column(name = "resulting_status", nullable = false)
    private String resultingStatus;

    @Column(name = "actor_user_id", nullable = false)
    private String actorUserId;

    @Column(name = "actor_role")
    private String actorRole;

    @Column(name = "previous_event_id")
    private String previousEventId;

    @Column(name = "metadata", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
