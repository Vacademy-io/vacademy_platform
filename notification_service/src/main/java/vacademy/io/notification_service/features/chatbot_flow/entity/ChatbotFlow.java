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
@Table(name = "chatbot_flow")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotFlow {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "channel_type", nullable = false, length = 50)
    private String channelType;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "DRAFT";

    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "trigger_config", columnDefinition = "TEXT")
    private String triggerConfig;

    @Column(name = "settings", columnDefinition = "TEXT")
    private String settings;

    @Column(name = "created_by")
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private Timestamp createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Timestamp updatedAt;
}
