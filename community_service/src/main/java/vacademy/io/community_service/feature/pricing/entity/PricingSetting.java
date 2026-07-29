package vacademy.io.community_service.feature.pricing.entity;

import jakarta.persistence.*;
import lombok.*;

/** Global commercial terms (GST, FX, billing-cycle multipliers), editable without a deploy. */
@Entity
@Table(name = "pricing_setting", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "key")
public class PricingSetting {

    @Id
    @Column(name = "key", length = 100)
    private String key;

    @Column(name = "value")
    private String value;

    @Column(name = "label")
    private String label;
}
