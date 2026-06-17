package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vacademy.io.notification_service.features.announcements.dto.AnnouncementEvent;
import vacademy.io.notification_service.features.announcements.enums.EventType;
import vacademy.io.notification_service.features.announcements.service.SSEConnectionManager;
import vacademy.io.notification_service.features.chat.dto.ChatMessagePayload;
import vacademy.io.notification_service.features.chat.dto.ChatMessageResponse;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.event.ChatFanoutEvent;
import vacademy.io.notification_service.features.firebase_notifications.service.PushNotificationService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Offline-delivery fallback for chat: when a chat message is fanned out, members who are NOT currently
 * connected over SSE get an FCM push so backgrounded users don't silently miss messages. Runs AFTER the
 * write commits, on the shared async pool, alongside (but independent of) the live SSE fan-out.
 *
 * <p>Scope (v1): DIRECT + BATCH_GROUP only — COMMUNITY has no explicit recipient list and pushing to a
 * whole institute per message would be spam. The sender is excluded. Deleted/tombstoned messages and
 * read-receipt events never push. Per-user mute/notification preferences are a follow-up.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatOfflinePushService {

    private final SSEConnectionManager connectionManager;
    private final PushNotificationService pushNotificationService;

    private static final int PREVIEW_MAX = 140;

    /**
     * Cap on offline recipients for a single BATCH_GROUP message push. Above this we skip the push to
     * avoid a notification storm + FCM cost blow-up on very large batches (per-user mute preferences are
     * the proper long-term fix). DIRECT is always pushed (1 recipient).
     */
    @Value("${chat.push.batch.max-recipients:200}")
    private int batchPushMaxRecipients;

    @Async("chatPushExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatFanout(ChatFanoutEvent e) {
        try {
            AnnouncementEvent event = e.getEvent();
            if (event == null || event.getType() != EventType.CHAT_MESSAGE) {
                return; // only new messages — not CHAT_READ
            }
            if (ChatConversationType.COMMUNITY.name().equals(e.getConversationType())) {
                return; // too broad for push
            }
            List<String> members = e.getMemberUserIds();
            if (members == null || members.isEmpty()) {
                return;
            }
            if (!(event.getData() instanceof ChatMessagePayload payload) || payload.getMessage() == null) {
                return;
            }
            ChatMessageResponse msg = payload.getMessage();
            if (Boolean.TRUE.equals(msg.getIsDeleted())) {
                return; // a delete also fans out a CHAT_MESSAGE — never push a tombstone
            }

            String senderId = msg.getSenderId();
            List<String> offline = members.stream()
                    .filter(id -> !id.equals(senderId))
                    .filter(id -> !connectionManager.isUserOnline(id))
                    .collect(Collectors.toList());
            if (offline.isEmpty()) {
                return;
            }
            if (offline.size() > batchPushMaxRecipients) {
                // Storm guard: a very large batch would fan a push to hundreds of devices per message.
                log.info("Skipping chat offline push ({}): {} offline recipients exceeds cap {}",
                        e.getConversationType(), offline.size(), batchPushMaxRecipients);
                return;
            }

            String title = (msg.getSenderName() != null && !msg.getSenderName().isBlank())
                    ? msg.getSenderName() : "New message";
            String body = previewOf(msg);

            Map<String, String> data = new HashMap<>();
            data.put("type", "chat");
            data.put("action", "open_conversation");
            data.put("conversationId", payload.getConversationId() != null ? payload.getConversationId() : "");
            if (msg.getId() != null) {
                data.put("messageId", msg.getId());
            }

            // PushNotificationService no-ops gracefully when an institute has no Firebase configured
            // or a user has no active token, and auto-deactivates dead tokens.
            pushNotificationService.sendNotificationToUsers(e.getInstituteId(), offline, title, body, data);
        } catch (Exception ex) {
            log.warn("Chat offline push failed for institute {}: {}", e.getInstituteId(), ex.getMessage());
        }
    }

    private String previewOf(ChatMessageResponse msg) {
        if (msg.getContent() != null && !msg.getContent().isBlank()) {
            String t = msg.getContent().trim();
            return t.length() > PREVIEW_MAX ? t.substring(0, PREVIEW_MAX) + "…" : t;
        }
        return switch (msg.getContentType() == null ? "TEXT" : msg.getContentType().toUpperCase()) {
            case "IMAGE" -> "📷 Photo";
            case "FILE" -> "📎 Attachment";
            default -> "New message";
        };
    }
}
