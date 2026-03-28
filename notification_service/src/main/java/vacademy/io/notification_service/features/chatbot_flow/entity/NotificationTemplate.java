package vacademy.io.notification_service.features.chatbot_flow.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "notification_template")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationTemplate {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "meta_template_id")
    private String metaTemplateId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "channel_type", length = 20)
    @Builder.Default
    private String channelType = "WHATSAPP";

    @Column(name = "language", length = 10)
    @Builder.Default
    private String language = "en";

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    // ==================== WhatsApp-specific fields ====================

    @Column(name = "header_type", length = 20)
    @Builder.Default
    private String headerType = "NONE";

    @Column(name = "header_text", columnDefinition = "TEXT")
    private String headerText;

    @Column(name = "header_sample_url", columnDefinition = "TEXT")
    private String headerSampleUrl;

    @Column(name = "body_text", columnDefinition = "TEXT") // nullable for EMAIL templates
    private String bodyText;

    @Column(name = "footer_text", columnDefinition = "TEXT")
    private String footerText;

    @Column(name = "buttons_config", columnDefinition = "TEXT")
    private String buttonsConfig;

    @Column(name = "body_sample_values", columnDefinition = "TEXT")
    private String bodySampleValues;

    @Column(name = "body_variable_names", columnDefinition = "TEXT")
    private String bodyVariableNames;

    @Column(name = "header_sample_values", columnDefinition = "TEXT")
    private String headerSampleValues;

    // ==================== Email-specific fields ====================

    @Column(name = "subject", columnDefinition = "TEXT")
    private String subject;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "content_type", length = 20)
    private String contentType;

    // ==================== General fields ====================

    @Column(name = "setting_json", columnDefinition = "TEXT")
    private String settingJson;

    @Column(name = "dynamic_parameters", columnDefinition = "TEXT")
    private String dynamicParameters;

    @Column(name = "can_delete")
    @Builder.Default
    private Boolean canDelete = true;

    @Column(name = "template_category", length = 50)
    private String templateCategory;

    @Column(name = "created_via_vacademy")
    @Builder.Default
    private boolean createdViaVacademy = true;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @Column(name = "submitted_at")
    private Timestamp submittedAt;

    @Column(name = "approved_at")
    private Timestamp approvedAt;
}
