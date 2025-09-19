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
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
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
    public void deliverContent(BenefitConfigDTO.ContentBenefitValue benefitValue, // <-- Corrected DTO
                               UserDTO referrerUser,
                               UserDTO refereeUser,
                               String instituteId,
                               List<FileDetailsDTO> fileDetails,
                               boolean isForReferee,
                               ReferralMapping referralMapping) {
        if (benefitValue == null || benefitValue.getDeliveryMediums() == null) {
            log.warn("Cannot deliver content, benefit details or delivery mediums are null.");
            return;
        }

        UserDTO targetUser = isForReferee ? refereeUser : referrerUser;

        for (BenefitConfigDTO.ContentBenefitValue.DeliveryMedium channel : benefitValue.getDeliveryMediums()) { // <-- Corrected DTO
            switch (channel) {
                case EMAIL:
                    sendEmailNotification(
                            targetUser,
                            referrerUser,
                            refereeUser,
                            instituteId,
                            benefitValue, // <-- Pass the whole value object
                            isForReferee,
                            fileDetails,
                            referralMapping);
                    break;
                case WHATSAPP:
                    sendWhatsAppNotification(targetUser);
                    break;
                default:
                    log.warn("Unsupported delivery medium: {}", channel);
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
                                       BenefitConfigDTO.ContentBenefitValue benefitValue, // <-- Corrected DTO
                                       boolean isForReferee,
                                       List<FileDetailsDTO> fileDetails,
                                       ReferralMapping referralMapping) {

        log.info("Preparing email for user {} via NotificationService.", targetUser.getEmail());

        String contentLinks = "<ul>" + fileDetails.stream()
                .map(file -> "<li><a href=\"" + file.getUrl() + "\" target=\"_blank\">" + file.getFileName() + "</a></li>")
                .collect(Collectors.joining()) + "</ul>";

        String defaultBody = isForReferee
                ? ReferralsEmailBody.REFEREE_EMAIL_BODY
                : ReferralsEmailBody.REFERRER_EMAIL_BODY;

        String finalBody = (benefitValue.getBody() != null && !benefitValue.getBody().isBlank())
                ? benefitValue.getBody()
                : defaultBody;

        Map<String, String> placeholders = new HashMap<>();
        placeholders.put("REFERRER_NAME", referrerUser.getFullName());
        placeholders.put("REFEREE_NAME", refereeUser.getFullName());
        placeholders.put("USER_NAME", targetUser.getFullName());
        placeholders.put("CONTENT_LINKS", contentLinks);

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setBody(finalBody);
        notificationDTO.setSubject(benefitValue.getSubject() != null ? benefitValue.getSubject() : "You've Received a Referral Reward!");
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSource("REFERRAL_BENEFIT");
        notificationDTO.setSourceId(referralMapping.getId());

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
     * Placeholder for future WhatsApp integration.
     */
    private void sendWhatsAppNotification(UserDTO targetUser) {
        log.info("WhatsApp notification requested for user {}. Integration is pending.", targetUser.getId());
    }
}