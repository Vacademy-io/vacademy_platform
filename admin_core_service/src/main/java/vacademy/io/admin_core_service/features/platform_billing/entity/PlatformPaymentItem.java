package vacademy.io.admin_core_service.features.platform_billing.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Per-pack line item under a {@link PlatformPayment}. Snapshot fields preserve
 * the pack's identity + price + tax rate at purchase time so later catalog
 * edits cannot mutate historical orders.
 *
 * tax_rate_bps is in basis points (1800 = 18.00%).
 */
@Entity
@Table(name = "platform_payment_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PlatformPaymentItem {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "platform_payment_id", nullable = false)
    private String platformPaymentId;

    @Column(name = "pack_id", nullable = false)
    private String packId;

    @Column(name = "pack_code_snapshot", nullable = false, length = 64)
    private String packCodeSnapshot;

    @Column(name = "credits", nullable = false, precision = 12, scale = 2)
    private BigDecimal credits;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "base_amount_minor", nullable = false)
    private Long baseAmountMinor;

    @Column(name = "tax_rate_bps", nullable = false)
    private Integer taxRateBps;

    @Column(name = "tax_amount_minor", nullable = false)
    private Long taxAmountMinor;

    @Column(name = "total_amount_minor", nullable = false)
    private Long totalAmountMinor;

    @Column(name = "hsn_sac_snapshot", nullable = false, length = 8)
    private String hsnSacSnapshot;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
