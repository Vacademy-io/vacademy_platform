package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "audience_communication")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudienceCommunication {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "audience_id", nullable = false)
    private String audienceId;

    @Column(name = "channel", nullable = false, length = 50)
    private String channel;

    @Column(name = "template_name")
    private String templateName;

    @Column(name = "subject", length = 500)
    private String subject;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Column(name = "variable_mapping", columnDefinition = "TEXT")
    private String variableMapping;

    @Column(name = "filters", columnDefinition = "TEXT")
    private String filters;

    @Column(name = "recipient_count", nullable = false)
    @Builder.Default
    private int recipientCount = 0;

    @Column(name = "successful", nullable = false)
    @Builder.Default
    private int successful = 0;

    @Column(name = "failed", nullable = false)
    @Builder.Default
    private int failed = 0;

    @Column(name = "skipped", nullable = false)
    @Builder.Default
    private int skipped = 0;

    @Column(name = "batch_id")
    private String batchId;

    @Column(name = "status", nullable = false, length = 50)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
