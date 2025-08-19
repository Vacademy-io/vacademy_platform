package vacademy.io.notification_service.features.announcements.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.announcements.dto.MessageReplyRequest;
import vacademy.io.notification_service.features.announcements.dto.UserMessagesResponse;
import vacademy.io.notification_service.features.announcements.entity.MessageReply;
import vacademy.io.notification_service.features.announcements.entity.RichTextData;
import vacademy.io.notification_service.features.announcements.repository.MessageReplyRepository;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.repository.RichTextDataRepository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageReplyService {

    private final MessageReplyRepository messageReplyRepository;
    private final RichTextDataRepository richTextDataRepository;
    private final AnnouncementEventService eventService;

    @Transactional
    public UserMessagesResponse.MessageReplyResponse createReply(MessageReplyRequest request) {
        log.info("Creating reply for announcement: {} by user: {}", request.getAnnouncementId(), request.getUserId());
        
        try {
            // Create and save rich text data for the reply content
            RichTextData richTextData = new RichTextData(
                    request.getContent().getType(),
                    request.getContent().getContent()
            );
            richTextDataRepository.save(richTextData);
            
            // Create the reply
            MessageReply reply = new MessageReply();
            reply.setAnnouncementId(request.getAnnouncementId());
            reply.setParentMessageId(request.getParentMessageId());
            reply.setUserId(request.getUserId());
            reply.setUserName(request.getUserName());
            reply.setUserRole(request.getUserRole());
            reply.setRichTextId(richTextData.getId());
            reply.setIsActive(true);
            reply.setCreatedAt(LocalDateTime.now());
            reply.setUpdatedAt(LocalDateTime.now());
            
            messageReplyRepository.save(reply);
            
            log.info("Successfully created reply with ID: {}", reply.getId());
            try {
                AnnouncementEvent event = AnnouncementEvent.builder()
                        .type(EventType.MESSAGE_REPLY_ADDED)
                        .announcementId(request.getAnnouncementId())
                        .data(Map.of(
                                "replyId", reply.getId(),
                                "userId", request.getUserId(),
                                "parentMessageId", request.getParentMessageId()
                        ))
                        .build();
                eventService.sendToAnnouncementRecipients(request.getAnnouncementId(), event);
            } catch (Exception e) {
                log.warn("Failed to emit MESSAGE_REPLY_ADDED SSE for announcement {}", request.getAnnouncementId(), e);
            }
            return mapToMessageReplyResponse(reply, richTextData);
            
        } catch (Exception e) {
            log.error("Error creating reply for announcement: {}", request.getAnnouncementId(), e);
            throw new RuntimeException("Failed to create reply: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public Page<UserMessagesResponse.MessageReplyResponse> getAnnouncementReplies(String announcementId, Pageable pageable) {
        return messageReplyRepository.findByAnnouncementIdAndIsActiveOrderByCreatedAtDesc(announcementId, true, pageable)
                .map(this::mapToMessageReplyResponse);
    }

    @Transactional(readOnly = true)
    public List<UserMessagesResponse.MessageReplyResponse> getChildReplies(String parentReplyId) {
        List<MessageReply> childReplies = messageReplyRepository
                .findByParentMessageIdAndIsActiveOrderByCreatedAtAsc(parentReplyId, true);
        
        return childReplies.stream()
                .map(this::mapToMessageReplyResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserMessagesResponse.MessageReplyResponse updateReply(String replyId, MessageReplyRequest request) {
        MessageReply reply = messageReplyRepository.findById(replyId)
                .orElseThrow(() -> new RuntimeException("Reply not found: " + replyId));
        
        // Verify ownership
        if (!reply.getUserId().equals(request.getUserId())) {
            throw new RuntimeException("User not authorized to update this reply");
        }
        
        try {
            // Update rich text content
            RichTextData richTextData = richTextDataRepository.findById(reply.getRichTextId())
                    .orElseThrow(() -> new RuntimeException("Content not found for reply: " + replyId));
            
            richTextData.setType(request.getContent().getType());
            richTextData.setContent(request.getContent().getContent());
            richTextDataRepository.save(richTextData);
            
            // Update reply metadata
            reply.setUpdatedAt(LocalDateTime.now());
            messageReplyRepository.save(reply);
            
            log.info("Successfully updated reply: {}", replyId);
            return mapToMessageReplyResponse(reply, richTextData);
            
        } catch (Exception e) {
            log.error("Error updating reply: {}", replyId, e);
            throw new RuntimeException("Failed to update reply: " + e.getMessage(), e);
        }
    }

    @Transactional
    public void deleteReply(String replyId, String userId) {
        MessageReply reply = messageReplyRepository.findById(replyId)
                .orElseThrow(() -> new RuntimeException("Reply not found: " + replyId));
        
        // Verify ownership
        if (!reply.getUserId().equals(userId)) {
            throw new RuntimeException("User not authorized to delete this reply");
        }
        
        // Soft delete - mark as inactive
        reply.setIsActive(false);
        reply.setUpdatedAt(LocalDateTime.now());
        messageReplyRepository.save(reply);
        
        log.info("Successfully deleted reply: {} by user: {}", replyId, userId);
    }

    @Transactional(readOnly = true)
    public Page<UserMessagesResponse.MessageReplyResponse> getUserReplies(String userId, Pageable pageable) {
        return messageReplyRepository.findByUserIdAndIsActiveOrderByCreatedAtDesc(userId, true, pageable)
                .map(this::mapToMessageReplyResponse);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getReplyStats(String announcementId) {
        Map<String, Object> stats = new HashMap<>();
        
        // Total replies count
        Long totalReplies = messageReplyRepository.countByAnnouncementIdAndIsActive(announcementId, true);
        stats.put("totalReplies", totalReplies);
        
        // Top-level replies count
        List<MessageReply> topLevelReplies = messageReplyRepository
                .findTopLevelRepliesByAnnouncementId(announcementId);
        stats.put("topLevelReplies", topLevelReplies.size());
        
        // Threading stats
        Long totalThreads = topLevelReplies.stream()
                .mapToLong(reply -> messageReplyRepository.countByParentMessageIdAndIsActive(reply.getId(), true))
                .sum();
        stats.put("totalThreads", totalThreads);
        
        return stats;
    }

    // Helper methods
    private UserMessagesResponse.MessageReplyResponse mapToMessageReplyResponse(MessageReply reply) {
        // Load rich text data
        RichTextData richTextData = richTextDataRepository.findById(reply.getRichTextId())
                .orElse(null);
        
        return mapToMessageReplyResponse(reply, richTextData);
    }

    private UserMessagesResponse.MessageReplyResponse mapToMessageReplyResponse(MessageReply reply, RichTextData richTextData) {
        UserMessagesResponse.MessageReplyResponse response = new UserMessagesResponse.MessageReplyResponse();
        response.setId(reply.getId());
        response.setUserId(reply.getUserId());
        response.setUserName(reply.getUserName());
        response.setUserRole(reply.getUserRole());
        response.setCreatedAt(reply.getCreatedAt());
        
        // Set content
        if (richTextData != null) {
            UserMessagesResponse.RichTextDataResponse contentResponse = new UserMessagesResponse.RichTextDataResponse();
            contentResponse.setId(richTextData.getId());
            contentResponse.setType(richTextData.getType());
            contentResponse.setContent(richTextData.getContent());
            response.setContent(contentResponse);
        }
        
        // Count child replies
        Long childRepliesCount = messageReplyRepository.countByParentMessageIdAndIsActive(reply.getId(), true);
        response.setChildRepliesCount(childRepliesCount);
        
        return response;
    }
}