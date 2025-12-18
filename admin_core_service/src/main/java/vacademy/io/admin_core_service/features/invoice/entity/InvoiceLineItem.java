package vacademy.io.admin_core_service.features.invoice.entity;

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
@Table(name = "invoice_line_item")
public class InvoiceLineItem {
    
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Column(name = "item_type", nullable = false, length = 50)
    private String itemType; // PLAN, DISCOUNT, TAX, COUPON, REFERRAL

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "source_id")
    private String sourceId; // Reference to payment_log_line_item if applicable

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}


