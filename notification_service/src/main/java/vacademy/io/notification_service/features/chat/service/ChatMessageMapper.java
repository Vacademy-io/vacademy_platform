package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.entity.RichTextData;
import vacademy.io.notification_service.features.announcements.repository.RichTextDataRepository;
import vacademy.io.notification_service.features.chat.dto.ChatMessageResponse;
import vacademy.io.notification_service.features.chat.entity.ChatMessage;

@Component
@RequiredArgsConstructor
public class ChatMessageMapper {

    private final RichTextDataRepository richTextRepository;

    public ChatMessageResponse toResponse(ChatMessage msg) {
        return toResponse(msg, resolveContent(msg));
    }

    public ChatMessageResponse toResponse(ChatMessage msg, String content) {
        boolean deleted = Boolean.TRUE.equals(msg.getIsDeleted());
        return ChatMessageResponse.builder()
                .id(msg.getId())
                .conversationId(msg.getConversationId())
                .senderId(msg.getSenderId())
                .senderName(msg.getSenderName())
                .senderRole(msg.getSenderRole())
                .contentType(msg.getContentType())
                .content(deleted ? null : content)
                .attachmentUrl(deleted ? null : msg.getAttachmentUrl())
                .attachmentName(deleted ? null : msg.getAttachmentName())
                .attachmentMime(deleted ? null : msg.getAttachmentMime())
                .attachmentSize(deleted ? null : msg.getAttachmentSize())
                .replyToMessageId(msg.getReplyToMessageId())
                .seq(msg.getSeq())
                .isEdited(msg.getIsEdited())
                .isDeleted(msg.getIsDeleted())
                .isFlagged(msg.getIsFlagged())
                .createdAt(msg.getCreatedAt())
                .build();
    }

    private String resolveContent(ChatMessage msg) {
        if (msg.getRichTextId() == null) return null;
        return richTextRepository.findById(msg.getRichTextId()).map(RichTextData::getContent).orElse(null);
    }
}
