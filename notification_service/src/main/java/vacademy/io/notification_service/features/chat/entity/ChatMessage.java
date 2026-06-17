package vacademy.io.notification_service.features.chat.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @UuidGenerator
    @Id
    private String id;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "sender_id", nullable = false)
    private String senderId;

    @Column(name = "sender_name")
    private String senderName;

    @Column(name = "sender_role", length = 64)
    private String senderRole;

    @Column(name = "content_type", nullable = false, length = 32)
    private String contentType = "TEXT"; // ChatContentType

    @Column(name = "rich_text_id")
    private String richTextId;

    @Column(name = "attachment_url", length = 2048)
    private String attachmentUrl;

    @Column(name = "attachment_name", length = 512)
    private String attachmentName;

    @Column(name = "attachment_mime", length = 128)
    private String attachmentMime;

    @Column(name = "attachment_size")
    private Long attachmentSize;

    @Column(name = "reply_to_message_id")
    private String replyToMessageId;

    @Column(name = "client_dedup_key")
    private String clientDedupKey;

    @Column(nullable = false)
    private Long seq;

    @Column(name = "is_edited", nullable = false)
    private Boolean isEdited = false;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "is_flagged", nullable = false)
    private Boolean isFlagged = false;

    @Column(name = "flag_reason")
    private String flagReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
