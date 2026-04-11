package vacademy.io.notification_service.features.email_otp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.notification_service.constants.NotificationConstants;
import vacademy.io.notification_service.features.announcements.service.UserAnnouncementPreferenceService;
import vacademy.io.notification_service.service.EmailService;

@Slf4j
@Service
public class InviteNewUserService {

    @Autowired
    EmailService emailService;

    @Autowired
    UserAnnouncementPreferenceService userAnnouncementPreferenceService;

    public Boolean sendEmail(String to, String subject, String service, String body, String instituteId, String emailType) {
        return sendEmail(to, subject, service, body, instituteId, emailType, null);
    }

    public Boolean sendEmail(String to, String subject, String service, String body, String instituteId, String emailType, String userId) {
        try {
            String finalEmailType = StringUtils.hasText(emailType) ? emailType : NotificationConstants.UTILITY_EMAIL;

            // Check if user has unsubscribed from this email sender
            if (StringUtils.hasText(userId) && StringUtils.hasText(instituteId)) {
                try {
                    String fromAddress = emailService.resolveFromEmailAddress(instituteId, finalEmailType);
                    if (fromAddress != null && userAnnouncementPreferenceService.isEmailSenderUnsubscribed(
                            userId, instituteId, finalEmailType, fromAddress)) {
                        log.info("Skipping invite email to user {} ({}): unsubscribed from {} ({})",
                                userId, to, fromAddress, finalEmailType);
                        return false;
                    }
                } catch (Exception ex) {
                    log.warn("Failed to check unsubscribe preference for user {}: {}", userId, ex.getMessage());
                }
            }

            emailService.sendHtmlEmail(to, subject, service, body, instituteId, null, null, finalEmailType);
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    public Boolean sendTextEmail(String to, String subject, String body, String instituteId) {
        return sendTextEmail(to, subject, body, instituteId, null);
    }

    public Boolean sendTextEmail(String to, String subject, String body, String instituteId, String userId) {
        try {
            // Check if user has unsubscribed from this email sender
            if (StringUtils.hasText(userId) && StringUtils.hasText(instituteId)) {
                try {
                    String fromAddress = emailService.resolveFromEmailAddress(instituteId, null);
                    if (fromAddress != null && userAnnouncementPreferenceService.isEmailSenderUnsubscribed(
                            userId, instituteId, NotificationConstants.UTILITY_EMAIL, fromAddress)) {
                        log.info("Skipping text email to user {} ({}): unsubscribed", userId, to);
                        return false;
                    }
                } catch (Exception ex) {
                    log.warn("Failed to check unsubscribe preference for user {}: {}", userId, ex.getMessage());
                }
            }

            emailService.sendEmail(to, subject, body, instituteId);
        } catch (Exception e) {
            throw new VacademyException("Email not send");
        }
        return true;
    }
}
