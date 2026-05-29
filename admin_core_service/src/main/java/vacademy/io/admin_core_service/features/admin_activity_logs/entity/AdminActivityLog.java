package vacademy.io.admin_core_service.features.admin_activity_logs.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;

@Entity
@Table(name = "admin_activity_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminActivityLog {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "actor_id")
    private String actorId;

    @Column(name = "actor_name")
    private String actorName;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(name = "entity_type", nullable = false)
    private String entityType;

    @Column(name = "entity_id")
    private String entityId;

    @Column(name = "action", nullable = false)
    private String action;

    @Column(name = "http_method")
    private String httpMethod;

    @Column(name = "endpoint")
    private String endpoint;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "request_payload", columnDefinition = "jsonb")
    private String requestPayload;

    /** Snapshot of the entity *before* the mutation, populated only when
     *  {@code @Auditable(captureBefore = "...")} is set. Stored as JSON. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_payload", columnDefinition = "jsonb")
    private String beforePayload;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "response_status")
    private Integer responseStatus;

    @Column(name = "response_time_ms")
    private Long responseTimeMs;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
}
