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
public class ChatMessageResponse {
    private String id;
    private String conversationId;
    private String senderId;
    private String senderName;
    private String senderRole;
    private String contentType;
    private String content;          // resolved rich-text content (body)
    private String attachmentUrl;
    private String attachmentName;
    private String attachmentMime;
    private Long attachmentSize;
    private String replyToMessageId;
    private Long seq;
    private Boolean isEdited;
    private Boolean isDeleted;
    private Boolean isFlagged;
    private LocalDateTime createdAt;
}
