package vacademy.io.community_service.feature.roadmap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.util.Date;

/**
 * Single-row table holding the product roadmap the super-admin publishes. The row is keyed by a
 * fixed id, {@link #SINGLETON_ID}.
 */
@Entity
@Table(name = "product_roadmap", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class ProductRoadmap {

    public static final String SINGLETON_ID = "GLOBAL";

    @Id
    @Column(name = "id")
    private String id;

    @Lob
    @Column(name = "html_content", nullable = false)
    private String htmlContent;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
