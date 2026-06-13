package vacademy.io.community_service.feature.status.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.community_service.feature.status.enums.IncidentSeverity;
import vacademy.io.community_service.feature.status.enums.IncidentStatus;

import java.util.Date;

@Entity
@Table(name = "status_incident", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class StatusIncident {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 50, nullable = false)
    private IncidentStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", length = 50, nullable = false)
    private IncidentSeverity severity;

    /** Comma-separated component / service names; exposed as a list in the DTO. */
    @Column(name = "affected_components", columnDefinition = "text")
    private String affectedComponents;

    /**
     * Timeline of updates stored inline as a JSON array (newest-first):
     * [{id,status,message,createdBy,createdByName,createdAt}, ...].
     * Held as a raw JSON string and (de)serialized in the service layer.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "updates", columnDefinition = "jsonb")
    @Builder.Default
    private String updates = "[]";

    @Column(name = "started_at", nullable = false)
    private Date startedAt;

    @Column(name = "resolved_at")
    private Date resolvedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_by_name")
    private String createdByName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
