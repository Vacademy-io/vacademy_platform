package vacademy.io.notification_service.features.announcements.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import vacademy.io.notification_service.features.announcements.dto.MessageReplyRequest;
import vacademy.io.notification_service.features.announcements.dto.UserMessagesResponse;
import vacademy.io.notification_service.features.announcements.service.MessageReplyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notification-service/v1/message-replies")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class MessageRepliesController {

    private final MessageReplyService messageReplyService;

    /**
     * Create a reply to an announcement (for community/DM modes)
     */
    @PostMapping
    public ResponseEntity<UserMessagesResponse.MessageReplyResponse> createReply(@Valid @RequestBody MessageReplyRequest request) {
        try {
            UserMessagesResponse.MessageReplyResponse response = messageReplyService.createReply(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error creating reply", e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get replies for an announcement (top-level replies)
     */
    @GetMapping("/announcement/{announcementId}")
    public ResponseEntity<Page<UserMessagesResponse.MessageReplyResponse>> getAnnouncementReplies(
            @PathVariable String announcementId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<UserMessagesResponse.MessageReplyResponse> replies = messageReplyService
                    .getAnnouncementReplies(announcementId, pageable);
            return ResponseEntity.ok(replies);
        } catch (Exception e) {
            log.error("Error getting replies for announcement: {}", announcementId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get child replies for a parent reply (threading)
     */
    @GetMapping("/{parentReplyId}/children")
    public ResponseEntity<List<UserMessagesResponse.MessageReplyResponse>> getChildReplies(@PathVariable String parentReplyId) {
        try {
            List<UserMessagesResponse.MessageReplyResponse> childReplies = messageReplyService.getChildReplies(parentReplyId);
            return ResponseEntity.ok(childReplies);
        } catch (Exception e) {
            log.error("Error getting child replies for parent: {}", parentReplyId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Update reply content
     */
    @PutMapping("/{replyId}")
    public ResponseEntity<UserMessagesResponse.MessageReplyResponse> updateReply(
            @PathVariable String replyId,
            @Valid @RequestBody MessageReplyRequest request) {
        
        try {
            UserMessagesResponse.MessageReplyResponse response = messageReplyService.updateReply(replyId, request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error updating reply: {}", replyId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Delete reply (soft delete - mark as inactive)
     */
    @DeleteMapping("/{replyId}")
    public ResponseEntity<Map<String, String>> deleteReply(
            @PathVariable String replyId,
            @RequestParam String userId) {
        
        try {
            messageReplyService.deleteReply(replyId, userId);
            return ResponseEntity.ok(Map.of("message", "Reply deleted successfully"));
        } catch (Exception e) {
            log.error("Error deleting reply: {}", replyId, e);
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Failed to delete reply", "message", e.getMessage()));
        }
    }

    /**
     * Get user's replies across all announcements
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<UserMessagesResponse.MessageReplyResponse>> getUserReplies(
            @PathVariable String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        try {
            Pageable pageable = PageRequest.of(page, size);
            Page<UserMessagesResponse.MessageReplyResponse> replies = messageReplyService
                    .getUserReplies(userId, pageable);
            return ResponseEntity.ok(replies);
        } catch (Exception e) {
            log.error("Error getting user replies for user: {}", userId, e);
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Get reply statistics for an announcement
     */
    @GetMapping("/announcement/{announcementId}/stats")
    public ResponseEntity<Map<String, Object>> getReplyStats(@PathVariable String announcementId) {
        try {
            Map<String, Object> stats = messageReplyService.getReplyStats(announcementId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error getting reply stats for announcement: {}", announcementId, e);
            return ResponseEntity.badRequest().build();
        }
    }
}