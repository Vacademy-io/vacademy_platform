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
@Table(name = "chat_conversation_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatConversationMember {

    @UuidGenerator
    @Id
    private String id;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "user_role", length = 64)
    private String userRole; // normalized snapshot: STUDENT | TEACHER | ADMIN

    @Column(name = "member_role", nullable = false, length = 32)
    private String memberRole = "MEMBER"; // ChatMemberRole

    @Column(name = "last_read_seq", nullable = false)
    private Long lastReadSeq = 0L;

    @Column(name = "last_read_message_id")
    private String lastReadMessageId;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @Column(nullable = false)
    private Boolean muted = false;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "rules_acknowledged_version", nullable = false)
    private Integer rulesAcknowledgedVersion = 0;

    @Column(name = "rules_acknowledged_at")
    private LocalDateTime rulesAcknowledgedAt;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();
}
