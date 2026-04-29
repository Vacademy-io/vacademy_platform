package vacademy.io.notification_service.features.communication_timeline.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.communication_timeline.dto.CommunicationTimelineRequest;
import vacademy.io.notification_service.features.communication_timeline.dto.UnifiedCommunicationDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommunicationTimelineService {

    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;

    private static final Map<String, String[]> TYPE_TO_CHANNEL_DIRECTION = Map.of(
            "EMAIL", new String[]{"EMAIL", "OUTBOUND"},
            "INBOUND_EMAIL", new String[]{"EMAIL", "INBOUND"},
            "EMAIL_EVENT", new String[]{"EMAIL", "OUTBOUND"},
            "WHATSAPP_MESSAGE_OUTGOING", new String[]{"WHATSAPP", "OUTBOUND"},
            "WHATSAPP_MESSAGE_INCOMING", new String[]{"WHATSAPP", "INBOUND"},
            "WHATSAPP_OUTGOING", new String[]{"WHATSAPP", "OUTBOUND"}
    );

    @Transactional(readOnly = true)
    public Page<UnifiedCommunicationDTO> getUserCommunications(CommunicationTimelineRequest request) {
        log.info("Fetching communication timeline for userId: {}", request.getUserId());

        if (request.getUserId() == null || request.getUserId().isBlank()) {
            throw new IllegalArgumentException("userId must be provided");
        }

        Pageable pageable = PageRequest.of(
                request.getPage() != null ? request.getPage() : 0,
                request.getSize() != null ? request.getSize() : 20
        );

        // Build list of notification types to query based on channel/direction filters
        List<String> notificationTypes = resolveNotificationTypes(request.getChannels(), request.getDirection());

        // Query notification_log
        Page<NotificationLog> logs;
        if (request.getFromDate() != null || request.getToDate() != null) {
            logs = notificationLogRepository.findByUserIdAndTypesAndDateRange(
                    request.getUserId(), notificationTypes,
                    request.getFromDate(), request.getToDate(),
                    pageable);
        } else {
            logs = notificationLogRepository.findByUserIdAndNotificationTypeInOrderByNotificationDateDesc(
                    request.getUserId(), notificationTypes, pageable);
        }

        // Collect EMAIL log IDs for batch enrichment with tracking events
        List<String> emailLogIds = logs.getContent().stream()
                .filter(nl -> "EMAIL".equals(nl.getNotificationType()))
                .map(NotificationLog::getId)
                .collect(Collectors.toList());

        // Batch fetch latest email events
        Map<String, NotificationLog> latestEmailEvents = new HashMap<>();
        Map<String, List<NotificationLog>> allEmailEvents = new HashMap<>();
        if (!emailLogIds.isEmpty()) {
            try {
                List<NotificationLog> latestEvents = notificationLogRepository
                        .findLatestEmailEventsBySourceIdsNative(emailLogIds.toArray(new String[0]));
                for (NotificationLog event : latestEvents) {
                    latestEmailEvents.put(event.getSource(), event);
                }

                List<NotificationLog> allEvents = notificationLogRepository
                        .findEmailEventsBySourceIds(emailLogIds);
                for (NotificationLog event : allEvents) {
                    allEmailEvents.computeIfAbsent(event.getSource(), k -> new ArrayList<>()).add(event);
                }
            } catch (Exception e) {
                log.warn("Error batch-fetching email events: {}", e.getMessage());
            }
        }

        // Map to DTOs
        List<UnifiedCommunicationDTO> dtos = logs.getContent().stream()
                .map(nl -> mapToDTO(nl, latestEmailEvents, allEmailEvents))
                .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, logs.getTotalElements());
    }

    private List<String> resolveNotificationTypes(List<String> channels, String direction) {
        // All possible non-event types
        Map<String, List<String>> channelToTypes = Map.of(
                "EMAIL", List.of("EMAIL", "INBOUND_EMAIL"),
                "WHATSAPP", List.of("WHATSAPP_MESSAGE_OUTGOING", "WHATSAPP_MESSAGE_INCOMING", "WHATSAPP_OUTGOING")
        );

        Set<String> types = new LinkedHashSet<>();

        List<String> targetChannels = (channels == null || channels.isEmpty())
                ? List.of("EMAIL", "WHATSAPP")
                : channels;

        for (String channel : targetChannels) {
            List<String> channelTypes = channelToTypes.getOrDefault(channel.toUpperCase(), List.of());
            if ("INBOUND".equalsIgnoreCase(direction)) {
                channelTypes.stream()
                        .filter(this::isInboundType)
                        .forEach(types::add);
            } else if ("OUTBOUND".equalsIgnoreCase(direction)) {
                channelTypes.stream()
                        .filter(t -> !isInboundType(t))
                        .forEach(types::add);
            } else {
                types.addAll(channelTypes);
            }
        }

        // Ensure we always have at least one type
        if (types.isEmpty()) {
            types.addAll(List.of("EMAIL", "INBOUND_EMAIL",
                    "WHATSAPP_MESSAGE_OUTGOING", "WHATSAPP_MESSAGE_INCOMING", "WHATSAPP_OUTGOING"));
        }

        return new ArrayList<>(types);
    }

    private boolean isInboundType(String type) {
        return type.contains("INCOMING") || "INBOUND_EMAIL".equals(type);
    }

    private UnifiedCommunicationDTO mapToDTO(
            NotificationLog nl,
            Map<String, NotificationLog> latestEmailEvents,
            Map<String, List<NotificationLog>> allEmailEvents) {

        String[] channelDirection = TYPE_TO_CHANNEL_DIRECTION.getOrDefault(
                nl.getNotificationType(), new String[]{"UNKNOWN", "UNKNOWN"});

        String channel = channelDirection[0];
        String direction = channelDirection[1];

        UnifiedCommunicationDTO.UnifiedCommunicationDTOBuilder builder = UnifiedCommunicationDTO.builder()
                .id(nl.getId())
                .channel(channel)
                .direction(direction)
                .timestamp(nl.getNotificationDate())
                .source(nl.getSource())
                .sourceId(nl.getSourceId())
                .recipientInfo(nl.getChannelId())
                .senderInfo(nl.getSenderBusinessChannelId());

        // Channel-specific mapping
        if ("EMAIL_EVENT".equals(nl.getNotificationType())) {
            mapEmailEventFields(builder, nl);
        } else if ("EMAIL".equals(channel)) {
            mapEmailFields(builder, nl, latestEmailEvents, allEmailEvents);
        } else if ("WHATSAPP".equals(channel)) {
            mapWhatsAppFields(builder, nl);
        }

        return builder.build();
    }

    private void mapEmailFields(
            UnifiedCommunicationDTO.UnifiedCommunicationDTOBuilder builder,
            NotificationLog nl,
            Map<String, NotificationLog> latestEmailEvents,
            Map<String, List<NotificationLog>> allEmailEvents) {

        if ("INBOUND_EMAIL".equals(nl.getNotificationType())) {
            mapInboundEmailFields(builder, nl);
            return;
        }

        // Extract subject from body (first line or truncated)
        String body = nl.getBody();
        String title = truncate(body, 100);
        builder.title(title);
        builder.bodyPreview(truncate(body, 150));
        builder.fullBody(body);

        // Email status from tracking events
        NotificationLog latestEvent = latestEmailEvents.get(nl.getId());
        if (latestEvent != null) {
            String eventType = extractEmailEventType(latestEvent.getBody());
            builder.status(normalizeEmailStatus(eventType));
        } else {
            builder.status("PENDING");
        }

        // Build status timeline from all events
        List<NotificationLog> events = allEmailEvents.getOrDefault(nl.getId(), List.of());
        List<UnifiedCommunicationDTO.StatusEvent> timeline = new ArrayList<>(events.stream()
                .sorted(Comparator.comparing(
                        e -> e.getUpdatedAt() != null ? e.getUpdatedAt() : e.getCreatedAt(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(event -> UnifiedCommunicationDTO.StatusEvent.builder()
                        .status(normalizeEmailStatus(extractEmailEventType(event.getBody())))
                        .timestamp(event.getUpdatedAt() != null ? event.getUpdatedAt() : event.getCreatedAt())
                        .details(event.getBody())
                        .build())
                .toList());

        // Always prepend SENT event
        timeline.add(0, UnifiedCommunicationDTO.StatusEvent.builder()
                .status("SENT")
                .timestamp(nl.getNotificationDate())
                .details("Email sent")
                .build());

        builder.statusTimeline(timeline);
    }

    private void mapInboundEmailFields(
            UnifiedCommunicationDTO.UnifiedCommunicationDTOBuilder builder,
            NotificationLog nl) {

        String subject = nl.getBody(); // we store subject in body for inbound emails
        String fullBody = subject;
        String toAddress = null;

        if (nl.getMessagePayload() != null && !nl.getMessagePayload().isBlank()) {
            try {
                Map<String, Object> payload = objectMapper.readValue(
                        nl.getMessagePayload(), new TypeReference<Map<String, Object>>() {});
                Object bodyObj = payload.get("body");
                if (bodyObj instanceof String s) fullBody = s;
                Object toObj = payload.get("to");
                if (toObj instanceof String s) toAddress = s;
            } catch (Exception e) {
                log.debug("Could not parse INBOUND_EMAIL messagePayload for log {}: {}", nl.getId(), e.getMessage());
            }
        }

        builder.title(truncate(subject, 100));
        builder.bodyPreview(truncate(fullBody, 150));
        builder.fullBody(fullBody);
        builder.senderInfo(nl.getChannelId());           // From address (sender of the inbound email)
        if (toAddress != null) {
            builder.recipientInfo(toAddress);            // To address (our institute mailbox)
        }
        builder.status("RECEIVED");
        builder.statusTimeline(List.of(
                UnifiedCommunicationDTO.StatusEvent.builder()
                        .status("RECEIVED")
                        .timestamp(nl.getNotificationDate())
                        .details("Email received")
                        .build()
        ));
    }

    private void mapEmailEventFields(
            UnifiedCommunicationDTO.UnifiedCommunicationDTOBuilder builder,
            NotificationLog nl) {

        String eventType = extractEmailEventType(nl.getBody());
        String status = normalizeEmailStatus(eventType);

        builder.title("Email Event: " + status);
        builder.bodyPreview(truncate(nl.getBody(), 150));
        builder.fullBody(nl.getBody());
        builder.status(status);
        builder.statusTimeline(List.of(
                UnifiedCommunicationDTO.StatusEvent.builder()
                        .status(status)
                        .timestamp(nl.getNotificationDate())
                        .details(nl.getBody())
                        .build()
        ));
    }

    private void mapWhatsAppFields(
            UnifiedCommunicationDTO.UnifiedCommunicationDTOBuilder builder,
            NotificationLog nl) {

        String direction = TYPE_TO_CHANNEL_DIRECTION.getOrDefault(
                nl.getNotificationType(), new String[]{"UNKNOWN", "UNKNOWN"})[1];

        String body = nl.getBody();
        String messagePayload = nl.getMessagePayload();

        // Try to parse messagePayload for template info
        String templateName = null;
        String messageBody = body;
        Map<String, Object> metadata = new HashMap<>();

        if (messagePayload != null && !messagePayload.isBlank()) {
            try {
                Map<String, Object> payload = objectMapper.readValue(
                        messagePayload, new TypeReference<Map<String, Object>>() {});
                metadata = payload;

                // Extract template name from various payload structures
                if (payload.containsKey("template")) {
                    Object tmpl = payload.get("template");
                    if (tmpl instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> tmplMap = (Map<String, Object>) tmpl;
                        templateName = (String) tmplMap.get("name");
                    }
                }
                if (templateName == null && payload.containsKey("templateName")) {
                    templateName = (String) payload.get("templateName");
                }

                // Extract message body from payload
                if (payload.containsKey("text")) {
                    Object text = payload.get("text");
                    if (text instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> textMap = (Map<String, Object>) text;
                        messageBody = (String) textMap.get("body");
                    } else if (text instanceof String) {
                        messageBody = (String) text;
                    }
                }
            } catch (Exception e) {
                log.debug("Could not parse WA messagePayload for log {}: {}", nl.getId(), e.getMessage());
            }
        }

        String title = templateName != null ? templateName : truncate(body, 60);
        builder.title(title);
        builder.templateName(templateName);
        builder.bodyPreview(truncate(messageBody != null ? messageBody : body, 150));
        builder.fullBody(messageBody != null ? messageBody : body);
        builder.status("DELIVERED"); // WA messages in log are typically already delivered
        builder.metadata(metadata.isEmpty() ? null : metadata);

        // Simple status timeline for WA
        List<UnifiedCommunicationDTO.StatusEvent> timeline = new ArrayList<>();
        timeline.add(UnifiedCommunicationDTO.StatusEvent.builder()
                .status("INBOUND".equals(direction) ? "RECEIVED" : "SENT")
                .timestamp(nl.getNotificationDate())
                .details(body)
                .build());
        builder.statusTimeline(timeline);
    }

    private String extractEmailEventType(String body) {
        if (body == null || body.isEmpty()) return "unknown";
        if (body.startsWith("Email Event: ")) {
            int endIndex = body.indexOf("\n");
            if (endIndex > 0) {
                return body.substring("Email Event: ".length(), endIndex).trim().toLowerCase();
            }
            return body.substring("Email Event: ".length()).trim().toLowerCase();
        }
        return "unknown";
    }

    private String normalizeEmailStatus(String eventType) {
        if (eventType == null) return "PENDING";
        return switch (eventType.toLowerCase()) {
            case "delivery" -> "DELIVERED";
            case "open" -> "READ";
            case "click" -> "CLICKED";
            case "bounce" -> "BOUNCED";
            case "complaint" -> "COMPLAINT";
            case "send" -> "SENT";
            case "reject" -> "FAILED";
            default -> "PENDING";
        };
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return null;
        if (text.length() <= maxLen) return text;
        return text.substring(0, maxLen) + "...";
    }

    // ==================== Channel-ID based timeline ====================

    @Transactional(readOnly = true)
    public Page<UnifiedCommunicationDTO> getUserCommunicationsByChannel(CommunicationTimelineRequest request) {
        String email = request.getEmail();
        String phone = request.getPhone();

        boolean hasEmail = email != null && !email.isBlank();
        boolean hasPhone = phone != null && !phone.isBlank();

        if (!hasEmail && !hasPhone) {
            throw new IllegalArgumentException("email or phone must be provided");
        }

        Pageable pageable = PageRequest.of(
                request.getPage() != null ? request.getPage() : 0,
                request.getSize() != null ? request.getSize() : 20);

        // Reuse existing logic to resolve which notification types to include per channel
        List<String> emailTypes = resolveNotificationTypes(List.of("EMAIL"), request.getDirection());
        List<String> waTypes = resolveNotificationTypes(List.of("WHATSAPP"), request.getDirection());

        boolean fetchEmail = hasEmail && !emailTypes.isEmpty();
        boolean fetchWa = hasPhone && !waTypes.isEmpty();

        // If the caller filtered to specific channels, honour that
        List<String> requestedChannels = request.getChannels();
        if (requestedChannels != null && !requestedChannels.isEmpty()) {
            boolean wantEmail = requestedChannels.stream().anyMatch(c -> "EMAIL".equalsIgnoreCase(c));
            boolean wantWhatsApp = requestedChannels.stream().anyMatch(c -> "WHATSAPP".equalsIgnoreCase(c));
            fetchEmail = fetchEmail && wantEmail;
            fetchWa = fetchWa && wantWhatsApp;
        }

        Page<NotificationLog> logs;
        boolean hasDateRange = request.getFromDate() != null || request.getToDate() != null;

        if (fetchEmail && fetchWa) {
            logs = hasDateRange
                    ? notificationLogRepository.findByEmailAndPhoneChannelsAndDateRange(
                            email, phone, emailTypes, waTypes,
                            request.getFromDate(), request.getToDate(), pageable)
                    : notificationLogRepository.findByEmailAndPhoneChannels(
                            email, phone, emailTypes, waTypes, pageable);
        } else if (fetchEmail) {
            logs = hasDateRange
                    ? notificationLogRepository.findByChannelIdAndTypesAndDateRange(
                            email, emailTypes, request.getFromDate(), request.getToDate(), pageable)
                    : notificationLogRepository.findByChannelIdAndNotificationTypeInOrderByNotificationDateDesc(
                            email, emailTypes, pageable);
        } else if (fetchWa) {
            logs = hasDateRange
                    ? notificationLogRepository.findByChannelIdAndTypesAndDateRange(
                            phone, waTypes, request.getFromDate(), request.getToDate(), pageable)
                    : notificationLogRepository.findByChannelIdAndNotificationTypeInOrderByNotificationDateDesc(
                            phone, waTypes, pageable);
        } else {
            return new PageImpl<>(List.of(), pageable, 0);
        }

        List<String> emailLogIds = logs.getContent().stream()
                .filter(nl -> "EMAIL".equals(nl.getNotificationType()))
                .map(NotificationLog::getId)
                .collect(Collectors.toList());

        Map<String, NotificationLog> latestEmailEvents = new HashMap<>();
        Map<String, List<NotificationLog>> allEmailEvents = new HashMap<>();
        if (!emailLogIds.isEmpty()) {
            try {
                List<NotificationLog> latestEvents = notificationLogRepository
                        .findLatestEmailEventsBySourceIdsNative(emailLogIds.toArray(new String[0]));
                for (NotificationLog event : latestEvents) {
                    latestEmailEvents.put(event.getSource(), event);
                }
                List<NotificationLog> allEvents = notificationLogRepository
                        .findEmailEventsBySourceIds(emailLogIds);
                for (NotificationLog event : allEvents) {
                    allEmailEvents.computeIfAbsent(event.getSource(), k -> new ArrayList<>()).add(event);
                }
            } catch (Exception e) {
                log.warn("Error batch-fetching email events: {}", e.getMessage());
            }
        }

        List<UnifiedCommunicationDTO> dtos = logs.getContent().stream()
                .map(nl -> mapToDTO(nl, latestEmailEvents, allEmailEvents))
                .collect(Collectors.toList());

        return new PageImpl<>(dtos, pageable, logs.getTotalElements());
    }
}
