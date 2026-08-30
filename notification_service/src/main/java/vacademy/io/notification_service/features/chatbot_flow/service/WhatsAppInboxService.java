package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxConversationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxMessageDTO;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotEscalation;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class WhatsAppInboxService {

    /** Conversation list filters. */
    public static final String FILTER_UNANSWERED = "UNANSWERED";
    public static final String FILTER_FAILED = "FAILED";

    private final NotificationLogRepository notificationLogRepository;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final WhatsAppTemplateRenderer templateRenderer;
    private final ChatbotEscalationService escalationService;
    private final WhatsAppSendFailureService sendFailureService;
    private final ObjectMapper objectMapper;
    private final List<ChatbotMessageProvider> messageProviders;

    public List<InboxConversationDTO> getConversations(String instituteId, int offset, int limit) {
        return getConversations(instituteId, offset, limit, null);
    }

    /**
     * One page of the conversation list.
     *
     * @param filter {@code UNANSWERED} — only conversations the chatbot handed over and nobody has
     *               answered yet; {@code FAILED} — only conversations containing a message the
     *               provider refused to deliver; null/blank/ALL — everything.
     */
    public List<InboxConversationDTO> getConversations(String instituteId, int offset, int limit,
                                                       String filter) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        List<NotificationLog> logs = loadConversationPage(instituteId, offset, limit, filter);
        if (logs.isEmpty()) return List.of();

        Map<String, WhatsAppTemplateRenderer.InstituteTemplates> templateCache = templateRenderer.newCache();

        // Batch unread counts (single query, not N+1)
        List<String> phones = logs.stream().map(NotificationLog::getChannelId).collect(Collectors.toList());
        Map<String, Long> unreadMap = new HashMap<>();
        try {
            List<Object[]> unreadRows = notificationLogRepository.batchCountUnreadMessages(phones);
            for (Object[] row : unreadRows) {
                unreadMap.put((String) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception e) {
            log.warn("Failed to fetch unread counts: {}", e.getMessage());
        }

        // Two more batched lookups (still no N+1): who is waiting on a human, and where a send
        // was refused. Both drive badges on the conversation row so an admin sees them without
        // opening every chat.
        Map<String, ChatbotEscalation> pending = escalationService.findPendingByPhone(instituteId, phones);
        Map<String, Long> failedMap = batchFailedCounts(instituteId, phones);

        return logs.stream().map(nl -> {
            ChatbotEscalation escalation = pending.get(nl.getChannelId());
            return InboxConversationDTO.builder()
                    .phone(nl.getChannelId())
                    .senderName(nl.getSenderName())
                    .userId(nl.getUserId())
                    .lastMessage(truncate(templateRenderer.displayBody(nl, instituteId, templateCache), 60))
                    .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                    .lastMessageTime(nl.getNotificationDate())
                    .unreadCount(unreadMap.getOrDefault(nl.getChannelId(), 0L))
                    .awaitingReply(escalation != null)
                    .escalationId(escalation != null ? escalation.getId() : null)
                    .escalationReason(escalation != null ? escalation.getReason() : null)
                    .escalationMessage(escalation != null ? truncate(escalation.getUserMessage(), 140) : null)
                    .escalatedAt(escalation != null && escalation.getCreatedAt() != null
                            ? escalation.getCreatedAt().toInstant() : null)
                    .failedCount(failedMap.getOrDefault(nl.getChannelId(), 0L))
                    .build();
        }).collect(Collectors.toList());
    }

    /** Applies the requested filter to the conversation page query. */
    private List<NotificationLog> loadConversationPage(String instituteId, int offset, int limit,
                                                        String filter) {
        String normalized = filter == null ? "" : filter.trim().toUpperCase();

        if (FILTER_UNANSWERED.equals(normalized)) {
            // The phone list is authoritative here — it comes from the escalation table, not from
            // notification_log — so an empty set means "nothing is waiting", not "no data".
            List<String> waiting = new ArrayList<>(escalationService.findPendingPhones(instituteId));
            if (waiting.isEmpty()) return List.of();
            return notificationLogRepository.findConversationsForPhones(instituteId, waiting, limit, offset);
        }

        if (FILTER_FAILED.equals(normalized)) {
            return notificationLogRepository.findConversationsWithFailedSends(
                    instituteId, WhatsAppSendFailureService.FAILED_PAYLOAD_LIKE, limit, offset);
        }

        return notificationLogRepository.findConversationsForInbox(instituteId, limit, offset);
    }

    private Map<String, Long> batchFailedCounts(String instituteId, List<String> phones) {
        Map<String, Long> failedMap = new HashMap<>();
        try {
            for (Object[] row : notificationLogRepository.batchCountFailedMessages(
                    instituteId, phones, WhatsAppSendFailureService.FAILED_PAYLOAD_LIKE)) {
                failedMap.put((String) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception e) {
            log.warn("Failed to fetch undelivered message counts: {}", e.getMessage());
        }
        return failedMap;
    }

    public List<InboxMessageDTO> getMessages(String phone, String instituteId, String cursor, int limit) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        List<NotificationLog> logs = notificationLogRepository.findMessagesForPhone(phone, instituteId, cursor, limit);

        Map<String, WhatsAppTemplateRenderer.InstituteTemplates> templateCache = templateRenderer.newCache();

        return logs.stream().map(nl -> {
            WhatsAppTemplateRenderer.Rendered rm = templateRenderer.render(nl, instituteId, templateCache);
            // When we can rebuild the real template text, show it; otherwise fall back to the
            // stored body (free-text replies, incoming messages, or template no longer on file).
            String body = (rm != null && rm.body != null) ? rm.body : nl.getBody();

            // Free-text / interactive / media sends the provider refused carry the same
            // deliveryStatus + error contract on message_payload, but no templateName — so the
            // template renderer returns null for them. Read the marker directly.
            SendFailure failure = rm == null ? readSendFailure(nl.getMessagePayload()) : null;

            return InboxMessageDTO.builder()
                    .id(nl.getId())
                    .body(body)
                    .direction(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                    .timestamp(nl.getNotificationDate())
                    .source(nl.getSource())
                    .senderName(nl.getSenderName())
                    .status(nl.getNotificationType())
                    .templateName(rm != null ? rm.templateName : null)
                    .provider(rm != null ? rm.provider : null)
                    .deliveryStatus(rm != null ? rm.deliveryStatus
                            : (failure != null ? failure.status : null))
                    .error(rm != null ? rm.error : (failure != null ? failure.error : null))
                    .headerType(rm != null ? rm.headerType : null)
                    .headerMediaUrl(rm != null ? rm.headerMediaUrl : null)
                    .attemptedType(failure != null ? failure.attemptedType : null)
                    .build();
        }).collect(Collectors.toList());
    }

    /** The FAILED marker {@code WhatsAppSendFailureService} writes on non-template sends. */
    private record SendFailure(String status, String error, String attemptedType) {}

    private SendFailure readSendFailure(String messagePayload) {
        if (messagePayload == null || messagePayload.isBlank()) return null;
        if (!messagePayload.contains(WhatsAppSendFailureService.FAILED_STATUS)) return null;
        try {
            Map<String, Object> payload = objectMapper.readValue(messagePayload,
                    new TypeReference<Map<String, Object>>() {});
            Object status = payload.get("deliveryStatus");
            if (status == null || !WhatsAppSendFailureService.FAILED_STATUS.equals(status.toString())) {
                return null;
            }
            Object error = payload.get("error");
            Object attemptedType = payload.get("attemptedType");
            return new SendFailure(status.toString(),
                    error != null ? error.toString() : null,
                    attemptedType != null ? attemptedType.toString() : null);
        } catch (Exception e) {
            log.debug("Unparseable message payload on log row: {}", e.getMessage());
            return null;
        }
    }

    public List<InboxConversationDTO> searchConversations(String instituteId, String query) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        String safeQuery = "%" + query.replace("%", "\\%").replace("_", "\\_") + "%";
        List<NotificationLog> logs = notificationLogRepository.searchConversations(instituteId, safeQuery);

        Map<String, WhatsAppTemplateRenderer.InstituteTemplates> templateCache = templateRenderer.newCache();

        List<String> phones = logs.stream().map(NotificationLog::getChannelId).collect(Collectors.toList());
        Map<String, ChatbotEscalation> pending = escalationService.findPendingByPhone(instituteId, phones);
        Map<String, Long> failedMap = batchFailedCounts(instituteId, phones);

        return logs.stream().map(nl -> {
            ChatbotEscalation escalation = pending.get(nl.getChannelId());
            return InboxConversationDTO.builder()
                    .phone(nl.getChannelId())
                    .senderName(nl.getSenderName())
                    .userId(nl.getUserId())
                    .lastMessage(truncate(templateRenderer.displayBody(nl, instituteId, templateCache), 60))
                    .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                    .lastMessageTime(nl.getNotificationDate())
                    .awaitingReply(escalation != null)
                    .escalationId(escalation != null ? escalation.getId() : null)
                    .escalationReason(escalation != null ? escalation.getReason() : null)
                    .escalationMessage(escalation != null ? truncate(escalation.getUserMessage(), 140) : null)
                    .escalatedAt(escalation != null && escalation.getCreatedAt() != null
                            ? escalation.getCreatedAt().toInstant() : null)
                    .failedCount(failedMap.getOrDefault(nl.getChannelId(), 0L))
                    .build();
        }).collect(Collectors.toList());
    }

    public InboxMessageDTO sendReply(String phone, String text, String instituteId) {
        return sendReply(phone, text, instituteId, null);
    }

    /**
     * Human reply from the WhatsApp Inbox. Two things beyond the send itself:
     * <ul>
     *   <li>A provider refusal is written to notification_log as FAILED before the error is
     *       rethrown, so the attempt is visible in the thread instead of only in a toast the admin
     *       may already have dismissed.</li>
     *   <li>A successful reply resolves any open escalation on this conversation — the reply IS
     *       the answer the learner was waiting for, so the "Unanswered" badge clears on its own.</li>
     * </ul>
     *
     * @param repliedBy admin user id for the escalation audit trail; null falls back to INBOX_REPLY
     */
    public InboxMessageDTO sendReply(String phone, String text, String instituteId, String repliedBy) {
        List<ChannelToInstituteMapping> mappings = channelMappingRepository.findAllByInstituteId(instituteId);
        if (mappings.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "No WhatsApp channel configured for this institute");
        }

        // Validate text length (WhatsApp limit)
        if (text.length() > 4096) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Message too long. Maximum 4096 characters.");
        }

        ChannelToInstituteMapping mapping = mappings.get(0);
        String channelType = mapping.getChannelType();
        String businessChannelId = mapping.getChannelId();

        ChatbotMessageProvider provider = messageProviders.stream()
                .filter(p -> p.supports(channelType))
                .findFirst()
                .orElse(messageProviders.stream()
                        .filter(p -> p.supports("WHATSAPP"))
                        .findFirst()
                        .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.BAD_REQUEST, "No WhatsApp provider found")));

        String providerMessageId;
        try {
            providerMessageId = provider.sendText(phone, text, instituteId, businessChannelId);
        } catch (Exception e) {
            // Record the undelivered reply, then let the caller surface the error.
            sendFailureService.logFailure(instituteId, phone, businessChannelId, null,
                    "text", text, "INBOX", e.getMessage());
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY,
                    "WhatsApp rejected the message: " + e.getMessage());
        }

        NotificationLog outLog = new NotificationLog();
        outLog.setNotificationType("WHATSAPP_MESSAGE_OUTGOING");
        outLog.setChannelId(phone);
        outLog.setBody(text);
        outLog.setSource("INBOX");
        // wamid → source_id: lets the sent/delivered/read status webhooks join THIS row exactly
        // instead of falling back to "most recent outbound to this phone" (which could be a
        // different sender's row and misattribute the read).
        outLog.setSourceId(providerMessageId);
        outLog.setSenderBusinessChannelId(businessChannelId);
        outLog.setInstituteId(instituteId);
        outLog.setNotificationDate(Instant.now());

        // Link userId from previous messages
        try {
            notificationLogRepository
                    .findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(phone, "WHATSAPP_MESSAGE_OUTGOING")
                    .ifPresent(prev -> outLog.setUserId(prev.getUserId()));
        } catch (Exception ignored) {}

        notificationLogRepository.save(outLog);

        // A human has now answered — clear the "Unanswered" flag on this conversation.
        escalationService.resolveForPhone(instituteId, phone, repliedBy);

        return InboxMessageDTO.builder()
                .id(outLog.getId())
                .body(text)
                .direction("OUTGOING")
                .timestamp(outLog.getNotificationDate())
                .source("INBOX")
                .build();
    }

    /**
     * Send a free-form WhatsApp session reply ON BEHALF OF the Engagement Engine (auto-reply or a
     * human answering an escalated reply task). Same session-text primitive as {@link #sendReply},
     * but the outgoing log is stamped source=ENGAGEMENT_ENGINE + correlation_id=<engagement action
     * id> so the Phase-0 ledger attributes it to the engine (engine-gated correlation, §6.3). Legal
     * only inside Meta's 24h window — the caller (the engine) guarantees that. Returns the wamid.
     */
    public String sendEngagementReply(String phone, String text, String instituteId, String correlationId) {
        List<ChannelToInstituteMapping> mappings = channelMappingRepository.findAllByInstituteId(instituteId);
        if (mappings.isEmpty()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "No WhatsApp channel configured for this institute");
        }
        if (text == null || text.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Reply text is required");
        }
        if (text.length() > 4096) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Message too long. Maximum 4096 characters.");
        }

        ChannelToInstituteMapping mapping = mappings.get(0);
        String channelType = mapping.getChannelType();
        String businessChannelId = mapping.getChannelId();

        ChatbotMessageProvider provider = messageProviders.stream()
                .filter(p -> p.supports(channelType))
                .findFirst()
                .orElse(messageProviders.stream()
                        .filter(p -> p.supports("WHATSAPP"))
                        .findFirst()
                        .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                                org.springframework.http.HttpStatus.BAD_REQUEST, "No WhatsApp provider found")));

        String providerMessageId;
        try {
            providerMessageId = provider.sendText(phone, text, instituteId, businessChannelId);
        } catch (Exception e) {
            sendFailureService.logFailure(instituteId, phone, businessChannelId, null,
                    "text", text, "ENGAGEMENT_ENGINE", e.getMessage());
            throw e;
        }

        NotificationLog outLog = new NotificationLog();
        outLog.setNotificationType("WHATSAPP_MESSAGE_OUTGOING");
        outLog.setChannelId(phone);
        outLog.setBody(text);
        outLog.setSource("ENGAGEMENT_ENGINE");   // engine-gated: Phase-0 correlation stamping keys on this
        outLog.setSourceId(providerMessageId);   // wamid → exact join for the sent/delivered/read webhooks
        outLog.setCorrelationId(correlationId);  // the engagement action id → ledger attribution
        outLog.setSenderBusinessChannelId(businessChannelId);
        outLog.setInstituteId(instituteId);
        outLog.setNotificationDate(Instant.now());
        try {
            notificationLogRepository
                    .findTopByChannelIdAndNotificationTypeOrderByNotificationDateDesc(phone, "WHATSAPP_MESSAGE_OUTGOING")
                    .ifPresent(prev -> outLog.setUserId(prev.getUserId()));
        } catch (Exception ignored) {}
        notificationLogRepository.save(outLog);
        return providerMessageId;
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return null;
        return text.length() <= maxLen ? text : text.substring(0, maxLen) + "...";
    }
}
