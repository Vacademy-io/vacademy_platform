package vacademy.io.notification_service.features.hub.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.announcements.service.EmailConfigurationService;
import vacademy.io.notification_service.features.combot.entity.ChannelToInstituteMapping;
import vacademy.io.notification_service.features.combot.repository.ChannelToInstituteMappingRepository;
import vacademy.io.notification_service.features.hub.dto.HubOverviewDTO;
import vacademy.io.notification_service.features.hub.dto.HubRecentItemDTO;
import vacademy.io.notification_service.features.notification_log.entity.NotificationLog;
import vacademy.io.notification_service.features.notification_log.repository.EmailAddressMappingRepository;
import vacademy.io.notification_service.features.notification_log.repository.NotificationLogRepository;
import vacademy.io.notification_service.features.send.repository.SendBatchRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationHubService {

    private final NotificationLogRepository notificationLogRepository;
    private final EmailAddressMappingRepository emailAddressMappingRepository;
    private final EmailConfigurationService emailConfigurationService;
    private final ChannelToInstituteMappingRepository channelMappingRepository;
    private final SendBatchRepository sendBatchRepository;

    public HubOverviewDTO getOverview(String instituteId, int windowDays) {
        LocalDateTime sinceTs = LocalDateTime.now().minusDays(windowDays);
        String since = sinceTs.toString();

        List<String> emailFromAddresses = getInstituteEmailAddresses(instituteId);
        List<String> waChannelIds = getInstituteWhatsAppChannelIds(instituteId);

        log.debug("Hub overview: instituteId={} window={}d emailSenders={} waChannels={}",
                instituteId, windowDays, emailFromAddresses.size(), waChannelIds.size());

        HubOverviewDTO.EmailStats emailStats = HubOverviewDTO.EmailStats.builder()
                .configured(!emailFromAddresses.isEmpty())
                .inboundConfigured(emailAddressMappingRepository.existsByInstituteIdAndIsActiveTrue(instituteId))
                .build();

        if (!emailFromAddresses.isEmpty()) {
            emailStats.setSent(notificationLogRepository.countEmailSent(emailFromAddresses, since));
            emailStats.setDelivered(notificationLogRepository.countEmailEvent(emailFromAddresses, "DELIVERY", since));
            emailStats.setOpened(notificationLogRepository.countEmailEvent(emailFromAddresses, "OPEN", since));
            emailStats.setClicked(notificationLogRepository.countEmailEvent(emailFromAddresses, "CLICK", since));
            emailStats.setBounced(notificationLogRepository.countEmailEvent(emailFromAddresses, "BOUNCE", since));
            emailStats.setComplained(notificationLogRepository.countEmailEvent(emailFromAddresses, "COMPLAINT", since));
            emailStats.setInbound(notificationLogRepository.countInboundEmail(emailFromAddresses, since));
        }

        HubOverviewDTO.WhatsAppStats waStats = HubOverviewDTO.WhatsAppStats.builder()
                .configured(!waChannelIds.isEmpty())
                .build();

        if (!waChannelIds.isEmpty()) {
            waStats.setOutgoing(notificationLogRepository.countWhatsAppByType(waChannelIds, "WHATSAPP_MESSAGE_OUTGOING", since));
            waStats.setIncoming(notificationLogRepository.countWhatsAppByType(waChannelIds, "WHATSAPP_MESSAGE_INCOMING", since));
        }

        HubOverviewDTO.BatchStats batchStats = HubOverviewDTO.BatchStats.builder()
                .active(sendBatchRepository.countByInstituteIdAndStatusIn(instituteId, List.of("QUEUED", "PROCESSING")))
                .completedInWindow(sendBatchRepository.countByInstituteIdAndStatusSince(instituteId, "COMPLETED", sinceTs))
                .build();

        return HubOverviewDTO.builder()
                .windowDays(windowDays)
                .email(emailStats)
                .whatsapp(waStats)
                .batches(batchStats)
                .build();
    }

    public List<HubRecentItemDTO> getRecentIncoming(String instituteId, int limit, int offset) {
        List<String> channelIds = new ArrayList<>();
        channelIds.addAll(getInstituteWhatsAppChannelIds(instituteId));
        channelIds.addAll(getInstituteEmailAddresses(instituteId));

        if (channelIds.isEmpty()) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit, 100));
        int safeOffset = Math.max(0, offset);
        List<NotificationLog> rows = notificationLogRepository
                .findRecentIncomingForInstitute(channelIds, safeLimit, safeOffset);

        return rows.stream().map(this::toRecentItem).collect(Collectors.toList());
    }

    private HubRecentItemDTO toRecentItem(NotificationLog nl) {
        String channel = "INBOUND_EMAIL".equals(nl.getNotificationType()) ? "EMAIL" : "WHATSAPP";
        return HubRecentItemDTO.builder()
                .id(nl.getId())
                .channel(channel)
                .from(nl.getChannelId())
                .fromName(nl.getSenderName())
                .userId(nl.getUserId())
                .preview(truncate(nl.getBody(), 120))
                .timestamp(nl.getNotificationDate())
                .build();
    }

    /**
     * The institute's configured sender from-addresses (from institute.setting.EMAIL_SETTING.data).
     * NOT email_address_mapping — that table is only populated for inbound-enabled addresses
     * and would miss institutes that only send outbound. The platform default fallback is also
     * excluded so per-institute stat queries don't bleed across institutes.
     */
    private List<String> getInstituteEmailAddresses(String instituteId) {
        return emailConfigurationService.getInstituteConfiguredFromAddresses(instituteId);
    }

    private List<String> getInstituteWhatsAppChannelIds(String instituteId) {
        return channelMappingRepository.findAllByInstituteId(instituteId).stream()
                .map(ChannelToInstituteMapping::getChannelId)
                .filter(s -> s != null && !s.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
