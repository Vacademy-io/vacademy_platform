package vacademy.io.admin_core_service.features.platform_billing.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.admin_core_service.features.platform_billing.enums.PlatformPaymentResult;
import vacademy.io.admin_core_service.features.platform_billing.enums.PlatformPaymentStatus;

import java.time.LocalDateTime;

/**
 * One row per Razorpay order placed against the platform's account
 * (institute -> Vacademy direction). Distinct from {@code payment_log} which
 * records institute -> learner payments.
 */
@Entity
@Table(name = "platform_payment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PlatformPayment {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id", nullable = false, length = 255)
    private String instituteId;

    @Column(name = "buyer_user_id", length = 255)
    private String buyerUserId;

    @Column(name = "vendor", nullable = false, length = 32)
    private String vendor;

    @Column(name = "vendor_order_id", unique = true, length = 64)
    private String vendorOrderId;

    @Column(name = "vendor_payment_id", length = 64)
    private String vendorPaymentId;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "base_amount_minor", nullable = false)
    private Long baseAmountMinor;

    @Column(name = "tax_amount_minor", nullable = false)
    private Long taxAmountMinor;

    @Column(name = "total_amount_minor", nullable = false)
    private Long totalAmountMinor;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PlatformPaymentStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 32)
    private PlatformPaymentResult paymentStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payment_specific_data", columnDefinition = "jsonb")
    private String paymentSpecificData;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
