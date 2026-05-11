package vacademy.io.admin_core_service.features.credits.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * AI credit pack catalog entry. One row per purchasable SKU
 * (BASIC / PRO / BUSINESS / ENTERPRISE). Prices live in {@link CreditPackPrice}
 * keyed by currency.
 */
@Entity
@Table(name = "credit_pack")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreditPack {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "code", nullable = false, unique = true, length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "credits", nullable = false, precision = 12, scale = 2)
    private BigDecimal credits;

    @Column(name = "hsn_sac_code", nullable = false, length = 8)
    private String hsnSacCode;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "badge", length = 32)
    private String badge;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
