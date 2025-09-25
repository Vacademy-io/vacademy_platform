package vacademy.io.admin_core_service.features.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.notification.entity.NotificationEventConfig;
import vacademy.io.admin_core_service.features.notification.enums.NotificationEventType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationSourceType;
import vacademy.io.admin_core_service.features.notification.enums.NotificationTemplateType;
import vacademy.io.admin_core_service.features.notification.repository.NotificationEventConfigRepository;
import vacademy.io.admin_core_service.features.notification_service.service.SendUniqueLinkService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.learner.service.LearnerInvitationLinkService;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicNotificationService {

    private final NotificationEventConfigRepository configRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SendUniqueLinkService sendUniqueLinkService;
    private final LearnerInvitationLinkService learnerInvitationLinkService;
    private final InstituteService instituteService;

    /**
     * Send dynamic notifications based on event and package session
     */
    public void sendDynamicNotification(
            NotificationEventType eventName,
            String packageSessionId,
            String instituteId,
            UserDTO user,
            PaymentOption paymentOption,
            EnrollInvite enrollInvite) {

        try {
            // 1. Fetch package entity from package_session_id
            PackageEntity packageEntity = getPackageFromSessionId(packageSessionId);
            
            // 2. Get package session details
            PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found"));

            // 3. Find notification configurations for this event
            List<NotificationEventConfig> configs = configRepository.findByEventAndSource(
                    eventName, NotificationSourceType.BATCH, packageSessionId);

            // 4. If no configurations found, return early
            if (configs.isEmpty()) {
                log.info("No notification configurations found for event: {} and package session: {}", 
                        eventName, packageSessionId);
                return;
            }

            // 5. Create template variables
            NotificationTemplateVariables templateVars = NotificationTemplateVariables.fromEntities(
                    user,
                    packageEntity,
                    getInstituteFromId(instituteId), // You'll need to implement this
                    paymentOption,
                    enrollInvite,
                    packageSessionId,
                    packageSession.getLevel() != null ? packageSession.getLevel().getLevelName() : "",
                    packageSession.getSession() != null ? packageSession.getSession().getSessionName() : ""
            );
            // 6. Process each configuration
            for (NotificationEventConfig config : configs) {
                sendNotificationByType(config, instituteId, user, templateVars, enrollInvite);
            }

        } catch (Exception e) {
            log.error("Error sending dynamic notification for event: {} and package session: {}", 
                    eventName, packageSessionId, e);
            throw new VacademyException("Failed to send notification: " + e.getMessage());
        }
    }

    /**
     * Get package entity from package session ID
     */
    private PackageEntity getPackageFromSessionId(String packageSessionId) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package session not found with ID: " + packageSessionId));
        
        PackageEntity packageEntity = packageSession.getPackageEntity();
        if (packageEntity == null) {
            throw new VacademyException("Package not found for package session ID: " + packageSessionId);
        }
        
        return packageEntity;
    }


    /**
     * Send notification based on template type
     */
    private void sendNotificationByType(
            NotificationEventConfig config,
            String instituteId,
            UserDTO user,
            NotificationTemplateVariables templateVars,
            EnrollInvite enrollInvite) {

        try {
            switch (config.getTemplateType()) {
                case EMAIL:
                    sendUniqueLinkService.sendUniqueLinkByEmailByEnrollInvite(
                            instituteId, user, config.getTemplateId(), enrollInvite, templateVars);
                    log.info("Sent email notification using template: {} with dynamic variables", config.getTemplateId());
                    break;

                case WHATSAPP:
                    sendUniqueLinkService.sendUniqueLinkByWhatsApp(
                            instituteId, user, config.getTemplateId(), templateVars);
                    log.info("Sent WhatsApp notification using template: {} with dynamic variables", config.getTemplateId());
                    break;

                case SMS:
                    // Implement SMS sending if needed
                    log.info("SMS notification not implemented yet for template: {}", config.getTemplateId());
                    break;

                case PUSH:
                    // Implement push notification if needed
                    log.info("Push notification not implemented yet for template: {}", config.getTemplateId());
                    break;

                default:
                    log.warn("Unknown template type: {}", config.getTemplateType());
            }
        } catch (Exception e) {
            log.error("Error sending {} notification with template: {}", 
                    config.getTemplateType(), config.getTemplateId(), e);
        }
    }

    /**
     * Get institute from ID using the actual InstituteService
     */
    private Institute getInstituteFromId(String instituteId) {
        try {
            return instituteService.findById(instituteId);
        } catch (Exception e) {
            log.error("Error fetching institute with ID: {}", instituteId, e);
            // Return a fallback institute with default values
            Institute fallbackInstitute = new Institute();
            fallbackInstitute.setId(instituteId);
            fallbackInstitute.setInstituteName("Unknown Institute");
            return fallbackInstitute;
        }
    }

    private String getThemeColorFromInstitute(Institute institute) {
        if (institute == null || institute.getInstituteThemeCode() == null || 
            institute.getInstituteThemeCode().trim().isEmpty()) {
            return "#FF9800"; // Default orange color
        }
        
        String themeCode = institute.getInstituteThemeCode().trim();
        
        // If theme code is already a hex color, return it
        if (themeCode.startsWith("#") && themeCode.length() == 7) {
            return themeCode;
        }
        
        // If theme code is a hex color without #, add it
        if (themeCode.matches("^[0-9A-Fa-f]{6}$")) {
            return "#" + themeCode;
        }

        return "#FF9800"; // Default orange color
    }

    public void sendReferralInvitationNotification(
            String instituteId,
            UserDTO user,
            EnrollInvite enrollInvite) {

        try {
            // Find notification configurations for REFERRAL_INVITATION event
            List<NotificationEventConfig> configs = configRepository.findByEventAndSource(
                    NotificationEventType.REFERRAL_INVITATION, 
                    NotificationSourceType.INSTITUTE, 
                    instituteId);

            // If no institute-specific config found, look for global configs
            if (configs.isEmpty()) {
                configs = configRepository.findByEventAndSourceType(
                        NotificationEventType.REFERRAL_INVITATION, 
                        NotificationSourceType.INSTITUTE);
            }

            if (configs.isEmpty()) {
                log.info("No referral invitation notification configurations found for institute: {}", instituteId);
                return;
            }

            // Get institute details
            Institute institute = getInstituteFromId(instituteId);
            
            // Generate learner invitation response link
            String invitationLink = learnerInvitationLinkService
                    .generateLearnerInvitationResponseLink(instituteId, enrollInvite, user.getId());
            
            // Get theme color from institute (default to orange if not set)
            String themeColor = getThemeColorFromInstitute(institute);
            
            // Create template variables for referral invitation
            NotificationTemplateVariables templateVars = NotificationTemplateVariables.builder()
                    // User details
                    .userName(user.getUsername())
                    .userEmail(user.getEmail())
                    .userMobile(user.getMobileNumber())
                    .userFullName(user.getFullName())
                    
                    // Institute details
                    .instituteName(institute.getInstituteName())
                    .instituteId(institute.getId())
                    
                    // Enroll invite details
                    .enrollInviteCode(enrollInvite != null ? enrollInvite.getInviteCode() : "")
                    .enrollInviteExpiryDate(enrollInvite != null && enrollInvite.getEndDate() != null ?
                            enrollInvite.getEndDate().toString() : "")
                    
                    // Learner invitation response link
                    .learnerInvitationResponseLink(invitationLink)
                    
                    // Referral template variables
                    .name(user.getFullName() != null ? user.getFullName() : user.getUsername())
                    .referralLink(invitationLink)
                    .inviteCode(enrollInvite != null ? enrollInvite.getInviteCode() : "")
                    .themeColor(themeColor)
                    .build();

            // Process each configuration
            for (NotificationEventConfig config : configs) {
                sendNotificationByType(config, instituteId, user, templateVars, enrollInvite);
            }

        } catch (Exception e) {
            log.error("Error sending referral invitation notification for institute: {}", 
                    instituteId, e);
            throw new VacademyException("Failed to send referral invitation notification: " + e.getMessage());
        }
    }

    /**
     * Create notification configuration programmatically
     */
    public void createNotificationConfig(
            NotificationEventType eventName,
            NotificationSourceType sourceType,
            String sourceId,
            NotificationTemplateType templateType,
            String templateId) {

        try {
            NotificationEventConfig config = new NotificationEventConfig(
                    eventName, sourceType, sourceId, templateType, templateId);
            
            configRepository.save(config);
            log.info("Created notification config for event: {} with template: {}", 
                    eventName, templateId);
        } catch (Exception e) {
            log.error("Error creating notification config", e);
            throw new VacademyException("Failed to create notification config: " + e.getMessage());
        }
    }
}
