package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

/** A tick or cross shown under a plan. */
@Entity
@Table(name = "pricing_plan_feature", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PricingPlanFeature {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "plan_id", nullable = false)
    private String planId;

    @Column(name = "label")
    private String label;

    @Column(name = "included")
    private boolean included;

    @Column(name = "sort_order")
    private int sortOrder;
}
