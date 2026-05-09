package vacademy.io.admin_core_service.features.credits.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

/**
 * Per-currency price for a {@link CreditPack}. Amounts are stored in
 * minor units (paise for INR, cents for USD) — never use float for money.
 */
@Entity
@Table(name = "credit_pack_price")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreditPackPrice {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "pack_id", nullable = false)
    private String packId;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "amount_minor", nullable = false)
    private Long amountMinor;

    @Column(name = "is_tax_inclusive", nullable = false)
    private Boolean isTaxInclusive;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}
