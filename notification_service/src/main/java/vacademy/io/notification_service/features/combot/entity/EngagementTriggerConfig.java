package vacademy.io.notification_service.features.combot.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "engagement_trigger_config")
@Data
public class EngagementTriggerConfig {
    
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "channel_type", nullable = false, length = 50)
    private String channelType;

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(name = "source_identifier")
    private String sourceIdentifier;

    @Column(name = "threshold_seconds", nullable = false)
    private Integer thresholdSeconds;

    @Column(name = "threshold_type", length = 50)
    private String thresholdType = "CUMULATIVE";

    @Column(name = "template_name", columnDefinition = "TEXT", nullable = false)
    private String templateName;

    @Column(name = "template_variables", columnDefinition = "TEXT")
    private String templateVariables;

    @Column(name = "previous_template_name", columnDefinition = "TEXT")
    private String previousTemplateName;

    @Column(name = "require_previous_template")
    private boolean requirePreviousTemplate = false;

    @Column(name = "is_active")
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
