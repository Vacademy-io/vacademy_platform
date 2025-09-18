package vacademy.io.admin_core_service.features.user_subscription.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification_service.utils.ReferralsEmailBody;
import vacademy.io.admin_core_service.features.user_subscription.dto.ContentBenefitsConfigDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MultiChannelDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(MultiChannelDeliveryService.class);

    @Autowired
    private NotificationService notificationService;


    /**
     * Delivers a content benefit to the appropriate user(s) through the specified channels.
     */
    public void deliverContent(ContentBenefitsConfigDTO.BenefitDTO benefit,
                               UserDTO referrerUser,
                               UserDTO refereeUser,
                               String instituteId,
                               List<FileDetailsDTO> fileDetails,
                               boolean isForReferee) {
        if (benefit == null) {
            return;
        }

        UserDTO targetUser = isForReferee ? refereeUser : referrerUser;

        for (ContentBenefitsConfigDTO.DeliveryMedium channel : benefit.getDeliveryMediums()) {
            switch (channel.name()) {
                case "EMAIL":
                    sendEmailNotification(
                        targetUser,
                        referrerUser,
                        refereeUser,
                        instituteId,
                        benefit.getSubject(),
                        benefit.getBody(),
                        isForReferee,
                        fileDetails);
                    break;
                case "WHATSAPP":
                    sendWhatsAppNotification(targetUser);
                    break;
                default:
                    log.warn("Unsupported delivery medium: {}", channel.name());
            }
        }
    }

    /**
     * Sends an email using NotificationService with dynamic template resolution.
     */
    private void sendEmailNotification(UserDTO targetUser,
                                       UserDTO referrerUser,
                                       UserDTO refereeUser,
                                       String instituteId,
                                       String subject,
                                       String body,
                                       boolean isForReferee,
                                       List<FileDetailsDTO> fileDetails) {

        log.info("Preparing email for user {} via NotificationService.", targetUser.getEmail());

        // Build content links
        String contentLinks = fileDetails.stream()
            .map(file -> "<li><a href=\"" + file.getUrl() + "\" target=\"_blank\">" + file.getFileName() + "</a></li>")
            .collect(Collectors.joining());

        // Select default template if body is null
        String defaultBody = isForReferee
            ? ReferralsEmailBody.REFEREE_EMAIL_BODY
            : ReferralsEmailBody.REFERRER_EMAIL_BODY;

        String finalBody = (body != null && !body.isBlank()) ? body : defaultBody;

        // Fill placeholders
        Map<String, String> placeholders = new HashMap<>();
        placeholders.put("referrer_name".toUpperCase(), referrerUser.getFullName());
        placeholders.put("referee_name".toUpperCase(), refereeUser.getFullName());
        placeholders.put("user_name".toUpperCase(), targetUser.getUsername());
        placeholders.put("content_links".toUpperCase(), contentLinks);

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(finalBody);
        notificationDTO.setSubject(subject != null ? subject : "Referral Reward");
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSource("REFERRAL_BENEFIT");
        notificationDTO.setSourceId("REFERRAL_BENEFIT");
        NotificationToUserDTO notificationToUser = new NotificationToUserDTO();
        notificationToUser.setChannelId(targetUser.getEmail());
        notificationToUser.setPlaceholders(placeholders);
        notificationToUser.setUserId(targetUser.getId());
        notificationDTO.setUsers(List.of(notificationToUser));

        try {
            notificationService.sendEmailToUsers(notificationDTO, instituteId);
            log.info("Successfully queued email for user {}.", targetUser.getEmail());
        } catch (Exception e) {
            log.error("Failed to send email benefit to user {}: {}", targetUser.getId(), e.getMessage(), e);
        }
    }

    /**
     * Placeholder for WhatsApp integration.
     */
    private void sendWhatsAppNotification(UserDTO targetUser) {

    }
}
