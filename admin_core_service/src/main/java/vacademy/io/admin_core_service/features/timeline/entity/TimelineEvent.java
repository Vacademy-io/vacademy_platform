package vacademy.io.admin_core_service.features.timeline.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.sql.Timestamp;

/**
 * Entity representing an event in a timeline for an enquiry, applicant, or
 * student.
 */
@Entity
@Table(name = "timeline_event")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimelineEvent {

        @Id
        @UuidGenerator
        @Column(name = "id", nullable = false, unique = true)
        private String id;

        @Column(name = "type", nullable = false)
        private String type;

        @Column(name = "type_id", nullable = false)
        private String typeId;

        @Column(name = "action_type", nullable = false)
        private String actionType;

        @Column(name = "actor_type", nullable = false)
        private String actorType;

        @Column(name = "actor_id")
        private String actorId;

        @Column(name = "actor_name")
        private String actorName;

        @Column(name = "title", nullable = false)
        private String title;

        @Column(name = "description", columnDefinition = "TEXT")
        private String description;

        @JdbcTypeCode(SqlTypes.JSON)
        @Column(name = "metadata_json", columnDefinition = "jsonb")
        private String metadataJson;

        @Column(name = "created_at", insertable = false, updatable = false)
        private Timestamp createdAt;
}
