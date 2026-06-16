package vacademy.io.notification_service.features.chat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "chat_conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatConversation {

    @UuidGenerator
    @Id
    private String id;

    @Column(nullable = false, length = 32)
    private String type; // ChatConversationType

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "reference_id")
    private String referenceId; // package_session_id for BATCH_GROUP

    @Column(name = "pair_key", length = 512)
    private String pairKey; // canonical "<minUser>::<maxUser>" for DIRECT dedupe

    @Column(length = 512)
    private String title;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "last_message_seq", nullable = false)
    private Long lastMessageSeq = 0L;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "last_message_preview", length = 512)
    private String lastMessagePreview;

    @Column(name = "last_message_sender_id")
    private String lastMessageSenderId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rules")
    private Map<String, Object> rules; // in-channel override; null = use institute defaults

    @Column(name = "rules_version", nullable = false)
    private Integer rulesVersion = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
