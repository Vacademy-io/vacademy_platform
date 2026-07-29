package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

/** Another product this plan bundles in for free. */
@Entity
@Table(name = "pricing_plan_inclusion", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PricingPlanInclusion {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "plan_id", nullable = false)
    private String planId;

    @Column(name = "included_product_code", length = 50, nullable = false)
    private String includedProductCode;

    /** Null means whichever plan of that product is chosen is free. */
    @Column(name = "included_plan_code", length = 50)
    private String includedPlanCode;

    /** Null means the whole product is free; a number means that many units are. */
    @Column(name = "included_quantity")
    private Integer includedQuantity;

    @Column(name = "sort_order")
    private int sortOrder;
}
