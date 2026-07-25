package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxConversationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxMessageDTO;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.chatbot_flow.entity.NotificationTemplate;
import vacademy.io.notification_service.features.chatbot_flow.repository.NotificationTemplateRepository;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class WhatsAppInboxService {

    private final NotificationLogRepository notificationLogRepository;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final NotificationTemplateRepository notificationTemplateRepository;
    private final List<ChatbotMessageProvider> messageProviders;

    private static final ObjectMapper objectMapper = new ObjectMapper();
    /** Matches {{1}} / {{ name }} placeholders (token filled in per-call). */
    private static final String PLACEHOLDER_FMT = "\\{\\{\\s*%s\\s*\\}\\}";

    public List<InboxConversationDTO> getConversations(String instituteId, int offset, int limit) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        List<NotificationLog> logs = notificationLogRepository.findConversationsForInbox(instituteId, limit, offset);
        if (logs.isEmpty()) return List.of();

        TemplateLookup lookup = buildTemplateLookup(instituteId);

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

        return logs.stream().map(nl -> InboxConversationDTO.builder()
                .phone(nl.getChannelId())
                .senderName(nl.getSenderName())
                .userId(nl.getUserId())
                .lastMessage(truncate(displayBody(nl, lookup), 60))
                .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                .lastMessageTime(nl.getNotificationDate())
                .unreadCount(unreadMap.getOrDefault(nl.getChannelId(), 0L))
                .build()
        ).collect(Collectors.toList());
    }

    public List<InboxMessageDTO> getMessages(String phone, String instituteId, String cursor, int limit) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        List<NotificationLog> logs = notificationLogRepository.findMessagesForPhone(phone, instituteId, cursor, limit);

        TemplateLookup lookup = buildTemplateLookup(instituteId);

        return logs.stream().map(nl -> {
            RenderedMessage rm = renderTemplateMessage(nl, lookup);
            // When we can rebuild the real template text, show it; otherwise fall back to the
            // stored body (free-text replies, incoming messages, or template no longer on file).
            String body = (rm != null && rm.body != null) ? rm.body : nl.getBody();
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
                    .deliveryStatus(rm != null ? rm.deliveryStatus : null)
                    .error(rm != null ? rm.error : null)
                    .headerType(rm != null ? rm.headerType : null)
                    .build();
        }).collect(Collectors.toList());
    }

    public List<InboxConversationDTO> searchConversations(String instituteId, String query) {
        if (instituteId == null || instituteId.isBlank()) return List.of();

        String safeQuery = "%" + query.replace("%", "\\%").replace("_", "\\_") + "%";
        List<NotificationLog> logs = notificationLogRepository.searchConversations(instituteId, safeQuery);

        TemplateLookup lookup = buildTemplateLookup(instituteId);

        return logs.stream().map(nl -> InboxConversationDTO.builder()
                .phone(nl.getChannelId())
                .senderName(nl.getSenderName())
                .userId(nl.getUserId())
                .lastMessage(truncate(displayBody(nl, lookup), 60))
                .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                .lastMessageTime(nl.getNotificationDate())
                .build()
        ).collect(Collectors.toList());
    }

    public InboxMessageDTO sendReply(String phone, String text, String instituteId) {
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

        String providerMessageId = provider.sendText(phone, text, instituteId, businessChannelId);

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

        String providerMessageId = provider.sendText(phone, text, instituteId, businessChannelId);

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

    // ==================== Template message rendering ====================
    //
    // Outgoing template sends are stored with an opaque summary body
    // ("WhatsApp Template: launchoffer | Provider: META | Status: SUCCESS | Params: {...}").
    // The structured send context (templateName + bodyParams) is preserved separately on
    // NotificationLog.messagePayload, so we can rebuild the real message a recipient saw by
    // joining it with the stored template body and substituting the params — no schema change
    // and it works retroactively for every historical row.

    /** Rendered display text (or original body) for a log — used for conversation-list previews. */
    private String displayBody(NotificationLog nl, TemplateLookup lookup) {
        RenderedMessage rm = renderTemplateMessage(nl, lookup);
        return (rm != null && rm.body != null) ? rm.body : nl.getBody();
    }

    /**
     * Rebuilds the actual message body for an outgoing template send. Returns {@code null} for
     * anything that isn't a structured template send (incoming messages, free-text replies), and
     * a {@link RenderedMessage} whose {@code body} is {@code null} when the template is no longer
     * on file (caller then falls back to the stored summary body).
     */
    private RenderedMessage renderTemplateMessage(NotificationLog nl, TemplateLookup lookup) {
        if (nl == null || nl.getNotificationType() == null
                || !nl.getNotificationType().contains("OUTGOING")) {
            return null;
        }
        String payloadJson = nl.getMessagePayload();
        if (payloadJson == null || payloadJson.isBlank()) return null;

        try {
            Map<String, Object> payload = objectMapper.readValue(payloadJson,
                    new TypeReference<Map<String, Object>>() {});
            Object templateNameObj = payload.get("templateName");
            if (templateNameObj == null) return null;

            RenderedMessage rm = new RenderedMessage();
            rm.templateName = templateNameObj.toString();
            rm.provider = asString(payload.get("provider"));
            rm.error = asString(payload.get("error"));
            rm.deliveryStatus = rm.error != null ? "FAILED" : "SUCCESS";

            Map<String, String> bodyParams = asStringMap(payload.get("bodyParams"));
            Map<String, String> headerParams = asStringMap(payload.get("headerParams"));
            String language = asString(payload.get("languageCode"));

            NotificationTemplate tmpl = lookup.find(rm.templateName, language);
            if (tmpl != null) {
                rm.headerType = tmpl.getHeaderType();
                rm.body = composeMessage(tmpl, bodyParams, headerParams);
            }
            return rm;
        } catch (Exception e) {
            log.debug("Failed to render template message {}: {}", nl.getId(), e.getMessage());
            return null;
        }
    }

    /** Header text + substituted body + footer, joined the way it renders in WhatsApp. */
    private String composeMessage(NotificationTemplate tmpl, Map<String, String> bodyParams,
                                  Map<String, String> headerParams) {
        StringBuilder sb = new StringBuilder();

        String headerType = tmpl.getHeaderType();
        if ("TEXT".equalsIgnoreCase(headerType) && isNotBlank(tmpl.getHeaderText())) {
            String header = substitute(tmpl.getHeaderText(), null, headerParams).trim();
            if (!header.isEmpty()) sb.append(header).append("\n\n");
        } else if (isMediaHeader(headerType)) {
            sb.append("[").append(headerType.substring(0, 1).toUpperCase())
                    .append(headerType.substring(1).toLowerCase()).append("]\n\n");
        }

        String body = substitute(tmpl.getBodyText(), tmpl.getBodyVariableNames(), bodyParams);
        if (isNotBlank(body)) sb.append(body.trim());

        if (isNotBlank(tmpl.getFooterText())) {
            sb.append("\n\n").append(tmpl.getFooterText().trim());
        }

        String out = sb.toString().trim();
        return out.isEmpty() ? null : out;
    }

    /**
     * Substitutes template placeholders with param values. Covers both flavours WhatsApp
     * templates use: named ({@code {{name}}}) and positional ({@code {{1}}}). Positional mapping
     * uses the template's ordered variable-name array — position i maps to {@code {{i+1}}}.
     */
    private String substitute(String text, String orderingJson, Map<String, String> params) {
        if (text == null || params == null || params.isEmpty()) return text;

        String result = text;
        // Named-style placeholders — also covers positional templates whose params are keyed "1","2".
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (e.getKey() == null) continue;
            String value = e.getValue() != null ? e.getValue() : "";
            result = replacePlaceholder(result, e.getKey(), value);
            result = replacePlaceholder(result, cleanName(e.getKey()), value);
        }
        // Positional placeholders resolved through the ordered variable names.
        List<String> ordering = parseStringArray(orderingJson);
        for (int i = 0; i < ordering.size(); i++) {
            String value = lookupParam(params, ordering.get(i));
            if (value != null) {
                result = replacePlaceholder(result, String.valueOf(i + 1), value);
            }
        }
        return result;
    }

    private String replacePlaceholder(String text, String token, String value) {
        if (token == null || token.isEmpty()) return text;
        Pattern p = Pattern.compile(String.format(PLACEHOLDER_FMT, Pattern.quote(token)));
        return p.matcher(text).replaceAll(Matcher.quoteReplacement(value));
    }

    private String lookupParam(Map<String, String> params, String name) {
        if (name == null) return null;
        if (params.containsKey(name)) return params.get(name);
        String clean = cleanName(name);
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (cleanName(e.getKey()).equals(clean)) return e.getValue();
        }
        return null;
    }

    /** Same normalisation the unified send path uses for named→positional resolution. */
    private String cleanName(String name) {
        return name == null ? "" : name.trim().toLowerCase().replaceAll("[^a-z0-9_]", "_");
    }

    private List<String> parseStringArray(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return Arrays.asList(objectMapper.readValue(json, String[].class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, String> asStringMap(Object obj) {
        Map<String, String> out = new LinkedHashMap<>();
        if (obj instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (e.getKey() != null && e.getValue() != null) {
                    out.put(e.getKey().toString(), e.getValue().toString());
                }
            }
        }
        return out;
    }

    private String asString(Object obj) {
        return obj != null ? obj.toString() : null;
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    private boolean isMediaHeader(String headerType) {
        return "IMAGE".equalsIgnoreCase(headerType)
                || "VIDEO".equalsIgnoreCase(headerType)
                || "DOCUMENT".equalsIgnoreCase(headerType);
    }

    /** Loads every template for an institute once, so per-message rendering is a map lookup. */
    private TemplateLookup buildTemplateLookup(String instituteId) {
        Map<String, NotificationTemplate> byName = new HashMap<>();
        Map<String, NotificationTemplate> byNameLang = new HashMap<>();
        try {
            for (NotificationTemplate t : notificationTemplateRepository
                    .findByInstituteIdOrderByUpdatedAtDesc(instituteId)) {
                if (t.getName() == null) continue;
                String nameLower = t.getName().toLowerCase();
                byName.putIfAbsent(nameLower, t); // most-recently-updated wins
                String lang = t.getLanguage() != null ? t.getLanguage().toLowerCase() : "en";
                byNameLang.putIfAbsent(nameLower + "|" + lang, t);
            }
        } catch (Exception e) {
            log.warn("Failed to load templates for institute {}: {}", instituteId, e.getMessage());
        }
        return new TemplateLookup(byName, byNameLang);
    }

    /** Case-insensitive template resolver, preferring an exact language match. */
    private record TemplateLookup(Map<String, NotificationTemplate> byName,
                                  Map<String, NotificationTemplate> byNameLang) {
        NotificationTemplate find(String name, String language) {
            if (name == null) return null;
            String nameLower = name.toLowerCase();
            if (language != null && !language.isBlank()) {
                NotificationTemplate t = byNameLang.get(nameLower + "|" + language.toLowerCase());
                if (t != null) return t;
            }
            return byName.get(nameLower);
        }
    }

    private static class RenderedMessage {
        String body;           // rebuilt message text, or null when template unavailable
        String templateName;
        String provider;
        String deliveryStatus; // SUCCESS / FAILED
        String error;
        String headerType;
    }
}
