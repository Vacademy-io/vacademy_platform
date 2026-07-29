package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;

/** A sellable product with its own pricing model and its own plans. */
@Entity
@Table(name = "pricing_product", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PricingProduct {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "code", length = 50, nullable = false)
    private String code;

    @Column(name = "name")
    private String name;

    @Column(name = "tagline")
    private String tagline;

    @Column(name = "icon", length = 50)
    private String icon;

    @Column(name = "pricing_model", length = 30)
    private String pricingModel;

    @Column(name = "base_price")
    private BigDecimal basePrice;

    @Column(name = "unit_price")
    private BigDecimal unitPrice;

    @Column(name = "included_units")
    private Integer includedUnits;

    @Column(name = "unit_label")
    private String unitLabel;

    @Column(name = "min_quantity")
    private int minQuantity;

    @Column(name = "requires_product_code", length = 50)
    private String requiresProductCode;

    @Column(name = "mirrors_product_code", length = 50)
    private String mirrorsProductCode;

    @Column(name = "sort_order")
    private int sortOrder;

    @Column(name = "is_active")
    private boolean active;
}
