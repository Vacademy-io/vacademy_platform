package vacademy.io.notification_service.features.combot.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "channel_flow_config")
@Data
public class ChannelFlowConfig {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "channel_type")
    private String channelType;

    @Column(name = "current_template_name", columnDefinition = "TEXT")
    private String currentTemplateName;

    @Column(name = "response_template_config", columnDefinition = "TEXT")
    private String responseTemplateConfig;

    @Column(name = "variable_config", columnDefinition = "TEXT")
    private String variableConfig;

    @Column(name = "fixed_variables_config", columnDefinition = "TEXT")
    private String fixedVariablesConfig;

    /**
     * Action configuration for workflows, verification, and other actions.
     * JSON format:
     * {
     * "rules": [
     * {"trigger": "hello", "match_type": "exact", "actions": [{"type": "WORKFLOW",
     * "workflowId": "wf_id"}]},
     * {"trigger": "\\d{4,6}", "match_type": "regex", "actions": [{"type":
     * "VERIFICATION"}]}
     * ]
     * }
     */
    @Column(name = "action_template_config", columnDefinition = "TEXT")
    private String actionTemplateConfig;

    @Column(name = "is_active")
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
