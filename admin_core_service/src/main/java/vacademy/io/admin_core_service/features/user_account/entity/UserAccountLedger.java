package vacademy.io.admin_core_service.features.user_account.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_account_ledger")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAccountLedger {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    /**
     * DEBIT_ACCRUAL   – obligation created
     * CREDIT_PAYMENT  – money received
     * CREDIT_WAIVER   – full fee waiver / concession
     * CREDIT_ADJUSTMENT – partial concession
     * DEBIT_PENALTY   – penalty added
     */
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    /** Populated on DEBIT rows – when the obligation is due. */
    @Column(name = "due_date")
    private LocalDate dueDate;

    /** USER_PLAN, STUDENT_FEE_PAYMENT, ADMIN_INVOICE */
    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "invoice_id")
    private String invoiceId;

    /** payment_log.id or adjustment_history.id on CREDIT rows. */
    @Column(name = "reference_id")
    private String referenceId;

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
