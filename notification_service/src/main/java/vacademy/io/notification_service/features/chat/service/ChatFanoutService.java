package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vacademy.io.notification_service.features.announcements.service.SSEConnectionManager;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.event.ChatFanoutEvent;

import java.util.List;

/**
 * Delivers chat events over SSE AFTER the write transaction commits, on the shared async pool.
 * DIRECT/BATCH_GROUP fan out to the resolved member list; COMMUNITY broadcasts to online institute
 * users only (the natural cap — offline members catch up via REST on reconnect).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatFanoutService {

    private final SSEConnectionManager connectionManager;

    @Async("announcementDeliveryExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChatFanout(ChatFanoutEvent e) {
        try {
            if (ChatConversationType.COMMUNITY.name().equals(e.getConversationType())) {
                connectionManager.broadcastToInstitute(e.getInstituteId(), e.getEvent());
            } else {
                List<String> ids = e.getMemberUserIds();
                if (ids != null && !ids.isEmpty()) {
                    connectionManager.sendToUsers(ids, e.getEvent());
                }
            }
        } catch (Exception ex) {
            log.error("Error fanning out chat event for institute {}: {}", e.getInstituteId(), ex.getMessage(), ex);
        }
    }
}
