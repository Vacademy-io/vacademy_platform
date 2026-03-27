package vacademy.io.notification_service.features.chatbot_flow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxConversationDTO;
import vacademy.io.notification_service.features.chatbot_flow.dto.InboxMessageDTO;
import vacademy.io.notification_service.features.chatbot_flow.engine.provider.ChatbotMessageProvider;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class WhatsAppInboxService {

    private final NotificationLogRepository notificationLogRepository;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final List<ChatbotMessageProvider> messageProviders;

    private List<String> getChannelIds(String instituteId) {
        return channelMappingRepository.findAllByInstituteId(instituteId).stream()
                .map(ChannelToInstituteMapping::getChannelId)
                .collect(Collectors.toList());
    }

    public List<InboxConversationDTO> getConversations(String instituteId, int offset, int limit) {
        List<String> channelIds = getChannelIds(instituteId);
        if (channelIds.isEmpty()) return List.of();

        List<NotificationLog> logs = notificationLogRepository.findConversationsForInbox(channelIds, limit, offset);
        if (logs.isEmpty()) return List.of();

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
                .lastMessage(truncate(nl.getBody(), 60))
                .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                .lastMessageTime(nl.getNotificationDate() != null ? nl.getNotificationDate().toString() : null)
                .unreadCount(unreadMap.getOrDefault(nl.getChannelId(), 0L))
                .build()
        ).collect(Collectors.toList());
    }

    public List<InboxMessageDTO> getMessages(String phone, String instituteId, String cursor, int limit) {
        List<String> channelIds = getChannelIds(instituteId);
        if (channelIds.isEmpty()) return List.of();

        List<NotificationLog> logs = notificationLogRepository.findMessagesForPhone(phone, channelIds, cursor, limit);

        return logs.stream().map(nl -> InboxMessageDTO.builder()
                .id(nl.getId())
                .body(nl.getBody())
                .direction(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                .timestamp(nl.getNotificationDate() != null ? nl.getNotificationDate().toString() : null)
                .source(nl.getSource())
                .senderName(nl.getSenderName())
                .status(nl.getNotificationType())
                .build()
        ).collect(Collectors.toList());
    }

    public List<InboxConversationDTO> searchConversations(String instituteId, String query) {
        List<String> channelIds = getChannelIds(instituteId);
        if (channelIds.isEmpty()) return List.of();

        String safeQuery = "%" + query.replace("%", "\\%").replace("_", "\\_") + "%";
        List<NotificationLog> logs = notificationLogRepository.searchConversations(channelIds, safeQuery);

        return logs.stream().map(nl -> InboxConversationDTO.builder()
                .phone(nl.getChannelId())
                .senderName(nl.getSenderName())
                .userId(nl.getUserId())
                .lastMessage(truncate(nl.getBody(), 60))
                .lastMessageType(nl.getNotificationType().contains("OUTGOING") ? "OUTGOING" : "INCOMING")
                .lastMessageTime(nl.getNotificationDate() != null ? nl.getNotificationDate().toString() : null)
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

        provider.sendText(phone, text, instituteId, businessChannelId);

        NotificationLog outLog = new NotificationLog();
        outLog.setNotificationType("WHATSAPP_MESSAGE_OUTGOING");
        outLog.setChannelId(phone);
        outLog.setBody(text);
        outLog.setSource("INBOX");
        outLog.setSenderBusinessChannelId(businessChannelId);
        outLog.setNotificationDate(LocalDateTime.now());

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
                .timestamp(outLog.getNotificationDate().toString())
                .source("INBOX")
                .build();
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return null;
        return text.length() <= maxLen ? text : text.substring(0, maxLen) + "...";
    }
}
