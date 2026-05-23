package vacademy.io.notification_service.features.email_inbox.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.notification_service.features.announcements.service.EmailConfigurationService;
import vacademy.io.notification_service.features.email_inbox.dto.EmailConversationDTO;
import vacademy.io.notification_service.features.email_inbox.dto.EmailMessageDTO;
import vacademy.io.notification_service.features.email_inbox.dto.EmailReplyRequest;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.EmailAddressMappingRepository;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.features.send.dto.UnifiedSendRequest;
import vacademy.io.notification_service.features.send.service.UnifiedSendService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailInboxService {

    private static final int PREVIEW_MAX = 120;

    private final NotificationLogRepository notificationLogRepository;
    private final EmailAddressMappingRepository emailAddressMappingRepository;
    private final EmailConfigurationService emailConfigurationService;
    private final UnifiedSendService unifiedSendService;
    private final ObjectMapper objectMapper;

    // ==================== Conversations ====================

    /**
     * @param instituteAddress optional — narrows results to one institute sender. null/blank = all.
     * @param direction        ALL | SENT | RECEIVED. null = ALL.
     */
    public List<EmailConversationDTO> getConversations(String instituteId, int offset, int limit,
                                                       String instituteAddress, String direction) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        String senderFilter = narrowSender(instituteId, instituteAddress);
        // narrowSender returned a sentinel ("__none__") to mean "address doesn't belong to this institute".
        if (NO_MATCH.equals(senderFilter)) return List.of();

        List<String> types = resolveTypes(direction);
        List<NotificationLog> latest = notificationLogRepository
                .findEmailConversationsForInbox(instituteId, senderFilter, types, limit, offset);
        if (latest.isEmpty()) return List.of();

        Map<String, Long> unread = batchUnread(latest);

        return latest.stream()
                .map(nl -> toConversation(nl, unread))
                .collect(Collectors.toList());
    }

    public List<EmailConversationDTO> searchConversations(String instituteId, String rawQuery,
                                                          int offset, int limit,
                                                          String instituteAddress, String direction) {
        if (instituteId == null || instituteId.isBlank() || rawQuery == null || rawQuery.isBlank()) return List.of();

        String senderFilter = narrowSender(instituteId, instituteAddress);
        if (NO_MATCH.equals(senderFilter)) return List.of();

        String safe = "%" + rawQuery.replace("%", "\\%").replace("_", "\\_") + "%";
        List<String> types = resolveTypes(direction);
        int safeLimit = Math.max(1, Math.min(limit, 100));
        int safeOffset = Math.max(0, offset);
        List<NotificationLog> rows = notificationLogRepository
                .searchEmailConversations(instituteId, senderFilter, types, safe, safeLimit, safeOffset);
        Map<String, Long> unread = batchUnread(rows);
        return rows.stream().map(nl -> toConversation(nl, unread)).collect(Collectors.toList());
    }

    private Map<String, Long> batchUnread(List<NotificationLog> rows) {
        List<String> emails = rows.stream()
                .map(NotificationLog::getChannelId)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (emails.isEmpty()) return Map.of();
        Map<String, Long> result = new HashMap<>();
        try {
            for (Object[] row : notificationLogRepository.batchCountUnreadEmailMessages(emails)) {
                result.put((String) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception e) {
            log.warn("[EMAIL-INBOX] Failed to fetch unread counts: {}", e.getMessage());
        }
        return result;
    }

    private EmailConversationDTO toConversation(NotificationLog nl, Map<String, Long> unread) {
        boolean inbound = "INBOUND_EMAIL".equals(nl.getNotificationType());
        return EmailConversationDTO.builder()
                .email(nl.getChannelId())
                .name(nl.getSenderName())
                .userId(nl.getUserId())
                .lastMessageDirection(inbound ? "INCOMING" : "OUTGOING")
                .lastMessagePreview(buildPreview(nl))
                .lastMessageTime(nl.getNotificationDate())
                .unreadCount(unread.getOrDefault(nl.getChannelId(), 0L))
                .build();
    }

    // ==================== Messages ====================

    public List<EmailMessageDTO> getMessages(String instituteId, String counterpartyEmail,
                                             String cursor, int limit,
                                             String instituteAddress, String direction) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        String senderFilter = narrowSender(instituteId, instituteAddress);
        if (NO_MATCH.equals(senderFilter)) return List.of();

        List<String> types = resolveTypes(direction);
        List<NotificationLog> rows = notificationLogRepository
                .findEmailMessagesForConversation(counterpartyEmail, instituteId, senderFilter, types, cursor, limit);

        return rows.stream().map(this::toMessage).collect(Collectors.toList());
    }

    private EmailMessageDTO toMessage(NotificationLog nl) {
        boolean inbound = "INBOUND_EMAIL".equals(nl.getNotificationType());
        String subject = null;
        String body = nl.getBody();

        if (inbound && nl.getMessagePayload() != null) {
            // INBOUND_EMAIL stores subject/body separately in messagePayload JSON; body column is the subject (truncated).
            try {
                JsonNode payload = objectMapper.readTree(nl.getMessagePayload());
                subject = textOrNull(payload, "subject");
                String fullBody = textOrNull(payload, "body");
                if (fullBody != null) body = fullBody;
            } catch (Exception e) {
                log.debug("[EMAIL-INBOX] Failed to parse INBOUND_EMAIL payload for {}: {}", nl.getId(), e.getMessage());
            }
        }

        return EmailMessageDTO.builder()
                .id(nl.getId())
                .direction(inbound ? "INCOMING" : "OUTGOING")
                .subject(subject)
                .bodyPreview(truncate(stripHtml(body), PREVIEW_MAX))
                .body(body)
                .counterpartyEmail(nl.getChannelId())
                .instituteAddress(nl.getSenderBusinessChannelId())
                .timestamp(nl.getNotificationDate())
                .source(nl.getSource())
                .build();
    }

    // ==================== Reply ====================

    public EmailMessageDTO sendReply(EmailReplyRequest req) {
        if (req.getInstituteId() == null || req.getInstituteId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "instituteId is required");
        }
        if (req.getToEmail() == null || req.getToEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "toEmail is required");
        }
        if (req.getBody() == null || req.getBody().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "body is required");
        }

        // Sender validation: must be one of the institute's configured senders.
        List<String> instituteSenders = emailConfigurationService.getInstituteConfiguredFromAddresses(req.getInstituteId());
        if (instituteSenders.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Institute has no configured email senders");
        }

        String fromEmail = req.getFromEmail();
        if (fromEmail == null || fromEmail.isBlank()) {
            fromEmail = instituteSenders.get(0);
        } else if (!instituteSenders.contains(fromEmail.toLowerCase().trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "fromEmail is not a configured sender for this institute");
        }

        String subject = req.getSubject() != null && !req.getSubject().isBlank()
                ? req.getSubject()
                : "Re: (no subject)";

        UnifiedSendRequest send = UnifiedSendRequest.builder()
                .instituteId(req.getInstituteId())
                .channel("EMAIL")
                .recipients(List.of(UnifiedSendRequest.Recipient.builder()
                        .email(req.getToEmail())
                        .build()))
                .options(UnifiedSendRequest.SendOptions.builder()
                        .emailSubject(subject)
                        .emailBody(req.getBody())
                        .fromEmail(fromEmail)
                        .source("EMAIL_INBOX")
                        .build())
                .build();

        try {
            unifiedSendService.routeSync(send);
        } catch (Exception e) {
            log.error("[EMAIL-INBOX] Reply send failed institute={} to={}: {}",
                    req.getInstituteId(), req.getToEmail(), e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to send reply: " + e.getMessage());
        }

        // Return a shape that the UI can append optimistically.
        return EmailMessageDTO.builder()
                .direction("OUTGOING")
                .subject(subject)
                .bodyPreview(truncate(stripHtml(req.getBody()), PREVIEW_MAX))
                .body(req.getBody())
                .counterpartyEmail(req.getToEmail())
                .instituteAddress(fromEmail)
                .timestamp(java.time.Instant.now())
                .source("EMAIL_INBOX")
                .build();
    }

    // ==================== Helpers ====================

    /**
     * Sentinel returned by {@link #narrowSender} when the caller-supplied sender doesn't belong
     * to this institute — the inbox must return zero rows in that case (don't fall back to "all").
     */
    private static final String NO_MATCH = "__no_match__";

    /**
     * Resolve the optional sender-narrowing filter passed to the repository queries.
     * <ul>
     *   <li>If {@code instituteAddress} is blank → {@code null} (no narrowing; all senders for
     *       this institute).</li>
     *   <li>If it's set AND belongs to the institute's configured from-addresses → the
     *       normalized address.</li>
     *   <li>If it's set but does NOT belong → {@link #NO_MATCH}, signalling the caller to
     *       short-circuit with an empty result (defends against an admin peeking into
     *       another institute's data via a crafted query param).</li>
     * </ul>
     */
    private String narrowSender(String instituteId, String instituteAddress) {
        if (instituteAddress == null || instituteAddress.isBlank()) return null;
        String normalized = instituteAddress.toLowerCase().trim();
        List<String> configured = emailConfigurationService.getInstituteConfiguredFromAddresses(instituteId);
        return configured.contains(normalized) ? normalized : NO_MATCH;
    }

    /**
     * Map the {@code direction} query param to the {@code notification_type} list used by the
     * repo queries. Anything other than SENT/RECEIVED falls back to both (ALL).
     */
    private List<String> resolveTypes(String direction) {
        if (direction == null) return List.of("EMAIL", "INBOUND_EMAIL");
        return switch (direction.trim().toUpperCase()) {
            case "SENT", "OUTGOING", "OUTBOUND" -> List.of("EMAIL");
            case "RECEIVED", "INCOMING", "INBOUND" -> List.of("INBOUND_EMAIL");
            default -> List.of("EMAIL", "INBOUND_EMAIL");
        };
    }

    /** True if the institute has at least one active inbound email mapping (for UI gating). */
    public boolean isInboundConfigured(String instituteId) {
        return emailAddressMappingRepository.existsByInstituteIdAndIsActiveTrue(instituteId);
    }

    /** Configured from-addresses for the sender dropdown in the UI. */
    public List<String> getInstituteSenderAddresses(String instituteId) {
        return emailConfigurationService.getInstituteConfiguredFromAddresses(instituteId);
    }

    private String buildPreview(NotificationLog nl) {
        boolean inbound = "INBOUND_EMAIL".equals(nl.getNotificationType());
        String text = nl.getBody();
        if (inbound && nl.getMessagePayload() != null) {
            try {
                JsonNode payload = objectMapper.readTree(nl.getMessagePayload());
                // Prefer subject for inbound list previews — that's what real mail clients show.
                String subject = textOrNull(payload, "subject");
                if (subject != null && !subject.isBlank()) text = subject;
            } catch (Exception ignored) {}
        }
        return truncate(stripHtml(text), 60);
    }

    private String textOrNull(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) return null;
        String s = v.asText();
        return (s == null || s.isBlank()) ? null : s;
    }

    private String stripHtml(String s) {
        if (s == null) return null;
        // Cheap, good-enough strip for preview rendering. Inline tags removed, whitespace collapsed.
        return s.replaceAll("(?is)<style[^>]*>.*?</style>", " ")
                .replaceAll("(?is)<script[^>]*>.*?</script>", " ")
                .replaceAll("<[^>]+>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
