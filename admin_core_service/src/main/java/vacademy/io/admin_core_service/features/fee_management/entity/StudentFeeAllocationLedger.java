package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "student_fee_allocation_ledger")
public class StudentFeeAllocationLedger {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "payment_log_id", nullable = false)
    private String paymentLogId;

    @Column(name = "student_fee_payment_id", nullable = false)
    private String studentFeePaymentId;

    @Column(name = "amount_allocated", nullable = false)
    private BigDecimal amountAllocated;

    @Column(name = "allocation_type", nullable = false)
    private String allocationType; // e.g., PAYMENT, OVERPAYMENT, REFUND, ROLLOVER

    @Column(name = "remarks")
    private String remarks;

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
    }

    @PreUpdate
    protected void onUpdate() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }
}
