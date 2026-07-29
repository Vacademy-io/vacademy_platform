package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;

/** One purchasable tier of a product. */
@Entity
@Table(name = "pricing_plan", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PricingPlan {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "product_code", length = 50, nullable = false)
    private String productCode;

    @Column(name = "code", length = 50, nullable = false)
    private String code;

    @Column(name = "name")
    private String name;

    @Column(name = "description")
    private String description;

    /** Learners the tier covers; null for products that are not learner-tiered. */
    @Column(name = "unit_count")
    private Integer unitCount;

    /** Per unit for PER_LEARNER_TIER, absolute otherwise. */
    @Column(name = "price")
    private BigDecimal price;

    @Column(name = "is_popular")
    private boolean popular;

    @Column(name = "sort_order")
    private int sortOrder;

    @Column(name = "is_active")
    private boolean active;
}
