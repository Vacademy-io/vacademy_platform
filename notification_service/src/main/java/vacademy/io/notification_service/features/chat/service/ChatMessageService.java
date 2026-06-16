package vacademy.io.notification_service.features.chat.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.entity.RichTextData;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.enums.ModeType;
import vacademy.io.notification_service.features.announcements.repository.RichTextDataRepository;
import vacademy.io.notification_service.features.chat.dto.ChatMessagePageResponse;
import vacademy.io.notification_service.features.chat.dto.ChatMessagePayload;
import vacademy.io.notification_service.features.chat.dto.ChatMessageResponse;
import vacademy.io.notification_service.features.chat.dto.SendChatMessageRequest;
import vacademy.io.notification_service.features.chat.entity.ChatConversation;
import vacademy.io.notification_service.features.chat.entity.ChatConversationMember;
import vacademy.io.notification_service.features.chat.entity.ChatMessage;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.enums.ChatMemberRole;
import vacademy.io.notification_service.features.chat.event.ChatFanoutEvent;
import vacademy.io.notification_service.features.chat.repository.ChatConversationMemberRepository;
import vacademy.io.notification_service.features.chat.repository.ChatConversationRepository;
import vacademy.io.notification_service.features.chat.repository.ChatMessageRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMessageService {

    private final ChatConversationRepository convRepo;
    private final ChatConversationMemberRepository memberRepo;
    private final ChatMessageRepository messageRepo;
    private final RichTextDataRepository richTextRepo;
    private final ChatConversationService conversationService;
    private final ChatPermissionService permissionService;
    private final ChatRulesService rulesService;
    private final ChatReportService reportService;
    private final ChatMessageMapper messageMapper;
    private final ApplicationEventPublisher eventPublisher;

    // ---------------------------------------------------------------------
    // Send
    // ---------------------------------------------------------------------

    @Transactional
    public ChatMessageResponse send(String conversationId, String userId, String userRole, String userName,
                                    SendChatMessageRequest req) {
        // Idempotency: a retried POST with the same key returns the original message.
        if (req.getClientDedupKey() != null && !req.getClientDedupKey().isBlank()) {
            Optional<ChatMessage> dup = messageRepo.findByConversationIdAndSenderIdAndClientDedupKey(
                    conversationId, userId, req.getClientDedupKey());
            if (dup.isPresent()) {
                return messageMapper.toResponse(dup.get());
            }
        }

        // Lock the conversation row to serialize seq assignment.
        ChatConversation conv = convRepo.findByIdForUpdate(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND"));

        // Institute kill-switch: settings.chat.enabled = false disables all sends.
        if (!permissionService.isChatEnabled(conv.getInstituteId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }

        ChatConversationMember member = resolveCallerMemberForSend(conv, userId, userRole, userName);
        enforcePostPermission(conv, userRole, member);

        boolean hasText = req.getText() != null && !req.getText().isBlank();
        boolean hasAttachment = req.getAttachmentUrl() != null && !req.getAttachmentUrl().isBlank();
        if (!hasText && !hasAttachment) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EMPTY_MESSAGE");
        }

        // Reply target must be a live message in THIS conversation (no cross-conversation leakage).
        if (req.getReplyToMessageId() != null && !req.getReplyToMessageId().isBlank()) {
            ChatMessage replyTarget = messageRepo.findById(req.getReplyToMessageId()).orElse(null);
            if (replyTarget == null || Boolean.TRUE.equals(replyTarget.getIsDeleted())
                    || !conversationId.equals(replyTarget.getConversationId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "REPLY_TARGET_INVALID");
            }
        }

        // Community rules (acknowledgement, slow-mode, links/attachments, banned keywords).
        ChatRulesService.ModerationResult moderation =
                rulesService.enforceBeforeSend(conv, member, req.getContentType(), req.getText(), hasAttachment);

        // Institute attachment rules.
        String attachErr = permissionService.checkAttachment(conv.getInstituteId(), req.getContentType(), req.getAttachmentSize());
        if (attachErr != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, attachErr);
        }

        String richTextId = null;
        if (hasText) {
            RichTextData rt = new RichTextData(req.getRichTextType() != null ? req.getRichTextType() : "text", req.getText());
            richTextId = richTextRepo.save(rt).getId();
        }

        long seq = (conv.getLastMessageSeq() == null ? 0L : conv.getLastMessageSeq()) + 1;

        ChatMessage msg = ChatMessage.builder()
                .conversationId(conversationId)
                .senderId(userId)
                .senderName(userName)
                .senderRole(ChatPermissionService.normalizeRole(userRole).toUpperCase())
                .contentType(req.getContentType() == null ? "TEXT" : req.getContentType().toUpperCase())
                .richTextId(richTextId)
                .attachmentUrl(req.getAttachmentUrl())
                .attachmentName(req.getAttachmentName())
                .attachmentMime(req.getAttachmentMime())
                .attachmentSize(req.getAttachmentSize())
                .replyToMessageId(req.getReplyToMessageId())
                .clientDedupKey(req.getClientDedupKey())
                .seq(seq)
                .isEdited(false)
                .isDeleted(false)
                .isFlagged(moderation.flagged())
                .flagReason(moderation.reason())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // On a concurrent dedup-key race the unique index throws DataIntegrityViolationException, which
        // poisons this transaction (rollback-only). We must NOT recover here — let it propagate and have
        // the controller re-query the winning message in a fresh transaction (see getByDedupKey).
        msg = messageRepo.saveAndFlush(msg);

        // Denormalized conversation summary for the list view.
        conv.setLastMessageSeq(seq);
        conv.setLastMessageAt(msg.getCreatedAt());
        conv.setLastMessagePreview(buildPreview(req.getText(), msg.getContentType()));
        conv.setLastMessageSenderId(userId);
        convRepo.save(conv);

        // Sender has implicitly read their own message.
        member.setLastReadSeq(seq);
        member.setLastReadMessageId(msg.getId());
        member.setLastReadAt(LocalDateTime.now());
        memberRepo.save(member);

        if (moderation.flagged()) {
            reportService.createSystemFlag(conv, msg, moderation.reason());
        }

        ChatMessageResponse response = messageMapper.toResponse(msg, req.getText());
        publishFanout(conv, userId, response);
        return response;
    }

    /**
     * Fresh-transaction recovery for a lost idempotency race: returns the message the winner persisted
     * for this (conversation, sender, clientDedupKey). Used by the controller after a
     * DataIntegrityViolationException from send().
     */
    @Transactional(readOnly = true)
    public ChatMessageResponse getByDedupKey(String conversationId, String userId, String clientDedupKey) {
        return messageRepo.findByConversationIdAndSenderIdAndClientDedupKey(conversationId, userId, clientDedupKey)
                .map(messageMapper::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "MESSAGE_CREATE_RACE"));
    }

    // ---------------------------------------------------------------------
    // Soft delete (tombstone)
    // ---------------------------------------------------------------------

    @Transactional
    public ChatMessageResponse deleteMessage(String conversationId, String messageId, String userId, String userRole) {
        ChatConversation conv = convRepo.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND"));
        ChatMessage msg = messageRepo.findById(messageId)
                .filter(m -> conversationId.equals(m.getConversationId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND"));

        // Sender may delete their own message; otherwise the caller must be an active moderator/owner.
        boolean isSender = userId.equals(msg.getSenderId());
        boolean isModerator = !isSender && memberRepo.findByConversationIdAndUserId(conversationId, userId)
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .map(m -> ChatMemberRole.MODERATOR.name().equals(m.getMemberRole())
                        || ChatMemberRole.OWNER.name().equals(m.getMemberRole()))
                .orElse(false);
        if (!isSender && !isModerator) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_ALLOWED");
        }

        msg.setIsDeleted(true);
        msg.setRichTextId(null);
        msg.setAttachmentUrl(null);
        msg.setAttachmentName(null);
        msg.setAttachmentMime(null);
        msg.setAttachmentSize(null);
        msg = messageRepo.save(msg);

        // Re-render the tombstone on every other client.
        ChatMessageResponse response = messageMapper.toResponse(msg);
        publishFanout(conv, userId, response);
        return response;
    }

    private ChatConversationMember resolveCallerMemberForSend(ChatConversation conv, String userId, String userRole, String userName) {
        if (ChatConversationType.COMMUNITY.name().equals(conv.getType())) {
            ChatMemberRole role = "admin".equals(ChatPermissionService.normalizeRole(userRole))
                    ? ChatMemberRole.MODERATOR : ChatMemberRole.MEMBER;
            return conversationService.ensureMember(conv, userId, userRole, role);
        }
        // DIRECT / BATCH_GROUP: caller must already be an active member (re-validated at send-time).
        return memberRepo.findByConversationIdAndUserId(conv.getId(), userId)
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_A_MEMBER"));
    }

    private void enforcePostPermission(ChatConversation conv, String callerRole, ChatConversationMember member) {
        if (ChatConversationType.DIRECT.name().equals(conv.getType())) {
            ChatConversationMember other = memberRepo.findByConversationIdAndIsActiveTrue(conv.getId()).stream()
                    .filter(m -> !m.getUserId().equals(member.getUserId())).findFirst().orElse(null);
            if (!permissionService.canDirectMessage(conv.getInstituteId(), callerRole, other != null ? other.getUserRole() : null)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "DM_NOT_ALLOWED");
            }
        } else if (ChatConversationType.BATCH_GROUP.name().equals(conv.getType())) {
            if (!permissionService.canPostToBatch(conv.getInstituteId(), callerRole)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "POST_NOT_ALLOWED");
            }
        } else {
            if (!permissionService.canPostToCommunity(conv.getInstituteId(), callerRole)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "POST_NOT_ALLOWED");
            }
        }
    }

    private void publishFanout(ChatConversation conv, String senderId, ChatMessageResponse response) {
        AnnouncementEvent event = AnnouncementEvent.builder()
                .type(EventType.CHAT_MESSAGE)
                .modeType(ModeType.CHAT)
                .instituteId(conv.getInstituteId())
                .data(ChatMessagePayload.builder()
                        .conversationId(conv.getId())
                        .conversationType(conv.getType())
                        .message(response)
                        .build())
                .timestamp(LocalDateTime.now())
                .priority("MEDIUM")
                .eventId("chatmsg_" + response.getId())
                .build();

        List<String> memberIds = ChatConversationType.COMMUNITY.name().equals(conv.getType())
                ? Collections.emptyList()
                : conversationService.getActiveMemberIds(conv.getId());
        eventPublisher.publishEvent(new ChatFanoutEvent(conv.getInstituteId(), conv.getType(), memberIds, event));
    }

    private String buildPreview(String text, String contentType) {
        if (text != null && !text.isBlank()) {
            String trimmed = text.trim();
            return trimmed.length() > 120 ? trimmed.substring(0, 120) : trimmed;
        }
        return switch (contentType == null ? "TEXT" : contentType.toUpperCase()) {
            case "IMAGE" -> "📷 Photo";
            case "FILE" -> "📎 Attachment";
            default -> "";
        };
    }

    // ---------------------------------------------------------------------
    // Fetch (keyset pagination)
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ChatMessagePageResponse getMessages(String conversationId, String userId, Long beforeCursor, Long sinceCursor, int limit) {
        ChatConversation conv = convRepo.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND"));
        // Membership gate (community is open to institute members who have a row once opened).
        if (!ChatConversationType.COMMUNITY.name().equals(conv.getType())
                && !memberRepo.existsByConversationIdAndUserIdAndIsActiveTrue(conversationId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "NOT_A_MEMBER");
        }

        int size = limit <= 0 ? 40 : Math.min(limit, 100);
        PageRequest page = PageRequest.of(0, size);
        List<ChatMessage> rows;
        boolean hasMore = false;

        if (sinceCursor != null) {
            // Catch-up: messages newer than the cursor (oldest first).
            rows = messageRepo.findByConversationIdAndSeqGreaterThanAndIsDeletedFalseOrderBySeqAsc(conversationId, sinceCursor, page);
        } else if (beforeCursor != null) {
            // Older page (newest-first from DB, reversed for rendering).
            rows = messageRepo.findByConversationIdAndSeqLessThanAndIsDeletedFalseOrderBySeqDesc(conversationId, beforeCursor, page);
            hasMore = rows.size() == size;
            Collections.reverse(rows);
        } else {
            // Latest page.
            rows = messageRepo.findByConversationIdAndIsDeletedFalseOrderBySeqDesc(conversationId, page);
            hasMore = rows.size() == size;
            Collections.reverse(rows);
        }

        List<ChatMessageResponse> messages = new ArrayList<>(rows.stream().map(messageMapper::toResponse).toList());
        Long oldestSeq = messages.isEmpty() ? null : messages.get(0).getSeq();
        Long latestSeq = messages.isEmpty() ? null : messages.get(messages.size() - 1).getSeq();
        return new ChatMessagePageResponse(messages, hasMore, oldestSeq, latestSeq);
    }
}
