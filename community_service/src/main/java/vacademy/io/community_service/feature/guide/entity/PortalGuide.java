package vacademy.io.community_service.feature.guide.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/** A self-contained HTML walkthrough shown in the super-admin portal's Guides dock. */
@Entity
@Table(name = "portal_guide", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class PortalGuide {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    @Column(name = "file_id")
    private String fileId;

    @Column(name = "file_url", length = 2048, nullable = false)
    private String fileUrl;

    /** jsonb array of pathname prefixes this guide is relevant on. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "routes", columnDefinition = "jsonb", nullable = false)
    private String routes;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
