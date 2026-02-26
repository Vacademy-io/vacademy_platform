package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "student_fee_payment")
public class StudentFeePayment {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_plan_id", nullable = false)
    private String userPlanId;

    @Column(name = "package_session_ids")
    private String packageSessionIds;

    @Column(name = "cpo_id", nullable = false)
    private String cpoId;

    @Column(name = "asv_id", nullable = false)
    private String asvId;

    @Column(name = "i_id", nullable = false)
    private String iId;

    @Column(name = "amount_expected", nullable = false)
    private BigDecimal amountExpected;

    @Column(name = "discount_amount")
    private BigDecimal discountAmount;

    @Column(name = "discount_reason")
    private String discountReason;

    @Column(name = "amount_paid")
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "due_date")
    private Date dueDate;

    @Column(name = "status", nullable = false)
    private String status; // e.g., PENDING, PARTIAL_PAID, PAID, WAIVED, OVERDUE

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (amountPaid == null) {
            amountPaid = BigDecimal.ZERO;
        }
        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }
}
