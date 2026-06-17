package vacademy.io.notification_service.features.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatConversationResponse {
    private String id;
    private String type;             // DIRECT | BATCH_GROUP | COMMUNITY
    private String instituteId;
    private String referenceId;      // package_session_id for BATCH_GROUP
    private String title;            // group/community name; for DIRECT, the other user's name
    private String otherUserId;      // for DIRECT: the counterpart user id
    private String lastMessagePreview;
    private String lastMessageSenderId;
    private LocalDateTime lastMessageAt;
    private Long lastMessageSeq;
    private long unreadCount;
    private String memberRole;       // caller's role in the conversation
    private Integer rulesVersion;
    private boolean canPost;         // whether the caller may post (permissions + rules)
}
