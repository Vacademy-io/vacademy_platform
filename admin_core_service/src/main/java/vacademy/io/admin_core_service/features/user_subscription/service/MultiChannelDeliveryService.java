package vacademy.io.admin_core_service.features.user_subscription.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.admin_core_service.features.notification_service.utils.ReferralsEmailBody;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.ReferralMapping;
import vacademy.io.admin_core_service.features.user_subscription.enums.ReferralBenefitType;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MultiChannelDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(MultiChannelDeliveryService.class);

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private MediaService mediaService;

    /**
     * Delivers a content benefit to the appropriate user(s) through the specified channels.
     */
    private void deliverContent(BenefitConfigDTO.ContentBenefitValue benefitValue,
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

        for (BenefitConfigDTO.ContentBenefitValue.DeliveryMedium channel : benefitValue.getDeliveryMediums()) {
            switch (channel) {
                case EMAIL:
                    sendEmailNotification(
                            targetUser,
                            referrerUser,
                            refereeUser,
                            instituteId,
                            benefitValue,
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
                                       BenefitConfigDTO.ContentBenefitValue benefitValue,
                                       boolean isForReferee,
                                       List<FileDetailsDTO> fileDetails,
                                       ReferralMapping referralMapping) {

        log.info("Preparing email for user {} via NotificationService.", targetUser.getEmail());

        // Build content links from both fileIds and contentUrl
        StringBuilder contentLinksBuilder = new StringBuilder("<ul>");

        // Add file links from media service
        fileDetails.forEach(file ->
                contentLinksBuilder.append("<li><a href=\"").append(file.getUrl())
                        .append("\" target=\"_blank\">").append(file.getFileName())
                        .append("</a></li>")
        );

        // Add external content URL (e.g., YouTube links)
        if (benefitValue.getContentUrl() != null && !benefitValue.getContentUrl().isBlank()) {
            String linkText = benefitValue.getContentUrl().contains("youtube") ? "Watch Video" : "View Content";
            contentLinksBuilder.append("<li><a href=\"").append(benefitValue.getContentUrl())
                    .append("\" target=\"_blank\">").append(linkText)
                    .append("</a></li>");
        }

        contentLinksBuilder.append("</ul>");
        String contentLinks = contentLinksBuilder.toString();

        String defaultBody = isForReferee
                ? ReferralsEmailBody.REFEREE_EMAIL_BODY
                : ReferralsEmailBody.REFERRER_EMAIL_BODY;

        String finalBody = (benefitValue.getBody() != null && !benefitValue.getBody().isBlank())
                ? benefitValue.getBody()
                : defaultBody;
        Institute institute = instituteRepository.findById(instituteId).get();
        String instituteLogoUrl = mediaService.getFileUrlById(institute.getLogoFileId());

        Map<String, String> placeholders = new HashMap<>();
        placeholders.put("REFERRER_NAME", referrerUser.getFullName());
        placeholders.put("REFEREE_NAME", refereeUser.getFullName());
        placeholders.put("USER_NAME", targetUser.getFullName());
        placeholders.put("CONTENT_LINKS", contentLinks);
        placeholders.put("INSTITUTE_LOGO_URL",instituteLogoUrl);
        placeholders.put("INSTITUTE_NAME",institute.getInstituteName());
        placeholders.put("INSTITUTE_URL",institute.getWebsiteUrl());
        placeholders.put("INSTITUTE_ADDRESS",institute.getAddress());

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

    /**
     * NEW: A robust method to send notifications for any benefit type.
     */
    public void sendReferralNotification(UserDTO referrerUser,
                                         UserDTO refereeUser,
                                         Object benefit,
                                         ReferralBenefitType benefitType,
                                         String instituteId,
                                         ReferralMapping referralMapping,
                                         boolean isForReferee) {

        UserDTO targetUser = isForReferee ? refereeUser : referrerUser;
        String subject = "You've received a referral reward!"; // Default subject
        String bodyContent = ""; // This will only be the core message

        switch (benefitType) {
            case CONTENT:
                // Content benefits have their own rich templates and multi-channel logic
                BenefitConfigDTO.ContentBenefitValue contentValue = (BenefitConfigDTO.ContentBenefitValue) benefit;
                List<FileDetailsDTO> fileDetails = new ArrayList<>();
                if (contentValue.getFileIds() != null && !contentValue.getFileIds().isEmpty()) {
                    fileDetails = mediaService.getFilesByIds(contentValue.getFileIds());
                }
                deliverContent(contentValue, referrerUser, refereeUser, instituteId, fileDetails, isForReferee, referralMapping);
                return; // Exit as deliverContent handles its own sending

            case POINTS:
                BenefitConfigDTO.PointBenefitValue pointsValue = (BenefitConfigDTO.PointBenefitValue) benefit;
                subject = isForReferee ? "Welcome! Your Bonus Points Are Here!" : "You've Earned Reward Points!";
                bodyContent = isForReferee
                        ? String.format("<p>Thanks for joining through <strong>%s</strong>'s referral. We've added <strong>%d bonus points</strong> to your account!</p>", referrerUser.getFullName(), pointsValue.getPoints())
                        : String.format("<p>Your referral of <strong>%s</strong> was successful! We've added <strong>%d points</strong> to your account.</p>", refereeUser.getFullName(), pointsValue.getPoints());
                break;

            case FLAT_DISCOUNT:
                BenefitConfigDTO.FlatDiscountValue flatValue = (BenefitConfigDTO.FlatDiscountValue) benefit;
                subject = isForReferee ? "A Welcome Gift For You!" : "You've Earned a Reward!";
                bodyContent = isForReferee
                        ? String.format("<p>As a special gift for joining through <strong>%s</strong>'s referral, here is a <strong>₹%.2f discount</strong> on your first order.</p>", referrerUser.getFullName(), flatValue.getAmount())
                        : String.format("<p>Your referral of <strong>%s</strong> was successful! You've earned a <strong>₹%.2f discount</strong> for your next purchase.</p>", refereeUser.getFullName(), flatValue.getAmount());
                break;

            case PERCENTAGE_DISCOUNT:
                BenefitConfigDTO.PercentageDiscountValue percValue = (BenefitConfigDTO.PercentageDiscountValue) benefit;
                subject = isForReferee ? "Your Welcome Discount is Here!" : "A Special Discount For You!";
                bodyContent = isForReferee
                        ? String.format("<p>Because you were referred by <strong>%s</strong>, you get a <strong>%.0f%% discount</strong> on your first order!</p>", referrerUser.getFullName(), percValue.getPercentage())
                        : String.format("<p>Thank you for referring <strong>%s</strong>! As a token of our appreciation, here is a <strong>%.0f%% discount</strong> for your next purchase.</p>", refereeUser.getFullName(), percValue.getPercentage());
                break;

            case FREE_MEMBERSHIP_DAYS:
                BenefitConfigDTO.MembershipExtensionValue daysValue = (BenefitConfigDTO.MembershipExtensionValue) benefit;
                subject = isForReferee ? "Your Membership Just Got an Upgrade!" : "We've Extended Your Membership!";
                bodyContent = isForReferee
                        ? String.format("<p>As a welcome gift from <strong>%s</strong>, we've added <strong>%d free days</strong> to your new membership!</p>", referrerUser.getFullName(), daysValue.getDays())
                        : String.format("<p>Thank you for successfully referring <strong>%s</strong>! We've extended your membership by an additional <strong>%d days</strong>.</p>", refereeUser.getFullName(), daysValue.getDays());
                break;
        }

        // Use the enhanced generic email sender for all non-content benefits
        queueGenericEmail(targetUser, subject, bodyContent, instituteId, referralMapping);
    }

    /**
     * A generic helper to queue emails that wraps the message in a full HTML
     * structure including institute branding.
     */
    private void queueGenericEmail(UserDTO targetUser, String subject, String bodyContent, String instituteId, ReferralMapping referralMapping) {
        Institute institute = instituteRepository.findById(instituteId)
                .orElseThrow(() -> new IllegalStateException("Institute not found with ID: " + instituteId));

        String logoUrl = mediaService.getFileUrlById(institute.getLogoFileId());

        // Create a full HTML body with a header and footer containing institute details
        String finalBody = String.format("""
        <!doctype html>
        <html>
        <head>
          <title>%s</title>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="%s" alt="%s Logo" width="150">
          </div>
          <h2>Hi %s,</h2>
          %s
          <hr>
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #777;">
            <p>
              <strong>%s</strong><br>
              %s<br>
              <a href="%s">Visit our website</a>
            </p>
          </div>
        </body>
        </html>
        """,
                subject,
                logoUrl, institute.getInstituteName(),
                targetUser.getFullName(),
                bodyContent,
                institute.getInstituteName(),
                institute.getAddress(),
                institute.getWebsiteUrl()
        );

        NotificationDTO notificationDTO = new NotificationDTO();
        notificationDTO.setSubject(subject);
        notificationDTO.setBody(finalBody);
        notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
        notificationDTO.setSource("REFERRAL_BENEFIT");
        notificationDTO.setSourceId(referralMapping.getId());

        NotificationToUserDTO notificationToUser = new NotificationToUserDTO();
        notificationToUser.setUserId(targetUser.getId());
        notificationToUser.setChannelId(targetUser.getEmail());
        notificationToUser.setPlaceholders(new HashMap<>()); // Body is pre-formatted
        notificationDTO.setUsers(List.of(notificationToUser));

        try {
            notificationService.sendEmailToUsers(notificationDTO, instituteId);
            log.info("Successfully queued generic referral email for user {}.", targetUser.getEmail());
        } catch (Exception e) {
            log.error("Failed to send generic referral email to user {}: {}", targetUser.getId(), e.getMessage(), e);
        }
    }
}