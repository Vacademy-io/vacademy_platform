package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chat.entity.ChatConversation;
import vacademy.io.notification_service.features.chat.enums.ChatConversationType;
import vacademy.io.notification_service.features.chat.repository.ChatConversationRepository;

import java.util.List;

/**
 * Reconciles materialized BATCH_GROUP membership against the live batch roster (admin-core).
 * The member rows are a cache; send-time also re-validates so a just-removed learner can't post
 * before the next sync. Manually-added moderators/owners are never auto-removed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMembershipSyncService {

    private final ChatConversationRepository convRepo;
    private final ChatMembershipReconciler reconciler;

    @Value("${chat.membership.sync.enabled:true}")
    private boolean syncEnabled;

    @Scheduled(fixedRateString = "${chat.membership.sync.interval:1800000}", initialDelayString = "${chat.membership.sync.initial-delay:120000}")
    public void reconcileBatchGroups() {
        if (!syncEnabled) {
            return;
        }
        List<ChatConversation> batches = convRepo.findByTypeAndIsActiveTrue(ChatConversationType.BATCH_GROUP.name());
        if (batches.isEmpty()) {
            return;
        }
        log.info("Chat membership sync: reconciling {} batch group(s)", batches.size());
        for (ChatConversation conv : batches) {
            try {
                // Cross-bean call so the reconciler's @Transactional boundary is honoured (a
                // self-invocation from this @Scheduled method would bypass the proxy = no transaction).
                reconciler.reconcileOne(conv);
            } catch (Exception e) {
                log.warn("Failed to reconcile batch group {} (ps={}): {}", conv.getId(), conv.getReferenceId(), e.getMessage());
            }
        }
    }
}
