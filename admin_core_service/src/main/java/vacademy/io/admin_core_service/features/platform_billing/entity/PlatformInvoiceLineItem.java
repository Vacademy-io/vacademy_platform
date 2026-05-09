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
 * Per-pack line under a {@link PlatformInvoice}. All amounts in minor units
 * (paise / cents), all rates in basis points (1800 = 18.00%).
 */
@Entity
@Table(name = "platform_invoice_line_item")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PlatformInvoiceLineItem {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "platform_invoice_id", nullable = false)
    private String platformInvoiceId;

    @Column(name = "description", nullable = false, length = 255)
    private String description;

    @Column(name = "hsn_sac_code", nullable = false, length = 8)
    private String hsnSacCode;

    @Column(name = "quantity", nullable = false, precision = 12, scale = 2)
    private BigDecimal quantity;

    @Column(name = "unit_price_minor", nullable = false)
    private Long unitPriceMinor;

    @Column(name = "base_amount_minor", nullable = false)
    private Long baseAmountMinor;

    @Column(name = "cgst_rate_bps", nullable = false)
    private Integer cgstRateBps;

    @Column(name = "cgst_amount_minor", nullable = false)
    private Long cgstAmountMinor;

    @Column(name = "sgst_rate_bps", nullable = false)
    private Integer sgstRateBps;

    @Column(name = "sgst_amount_minor", nullable = false)
    private Long sgstAmountMinor;

    @Column(name = "igst_rate_bps", nullable = false)
    private Integer igstRateBps;

    @Column(name = "igst_amount_minor", nullable = false)
    private Long igstAmountMinor;

    @Column(name = "total_amount_minor", nullable = false)
    private Long totalAmountMinor;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
