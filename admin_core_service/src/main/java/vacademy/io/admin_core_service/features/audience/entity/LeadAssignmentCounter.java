package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Tracks round-robin state for lead assignment.
 * One row per scope (either an Audience campaign or an Institute fallback).
 */
@Entity
@Table(name = "lead_assignment_counter",
       uniqueConstraints = @UniqueConstraint(columnNames = {"scope_type", "scope_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadAssignmentCounter {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "scope_type", nullable = false, length = 50)
    private String scopeType; // AUDIENCE or INSTITUTE

    @Column(name = "scope_id", nullable = false)
    private String scopeId;

    @Column(name = "last_index", nullable = false)
    @Builder.Default
    private Integer lastIndex = 0;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
