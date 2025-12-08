package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enrollment_policy.constants.EnrollmentTemplateConstants;
import vacademy.io.admin_core_service.features.enrollment_policy.enums.NotificationType;
import vacademy.io.admin_core_service.features.enrollment_policy.processor.EnrolmentContext;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for handling email templates in enrollment policy notifications.
 * Fetches templates from Templates table or uses default templates.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentTemplateService {

    private final TemplateRepository templateRepository;

    /**
     * Gets the email body for a notification, using template if specified or
     * default template.
     *
     * @param instituteId  Institute ID for template lookup
     * @param templateName Optional template name (if null, uses default)
     * @param context      Enrollment context for placeholder values
     * @return Email body with placeholders replaced
     */
    public String getEmailBody(String instituteId, String templateName, EnrolmentContext context) {
        String templateBody = getTemplateBody(instituteId, templateName);
        Map<String, String> placeholders = buildPlaceholders(context);
        return replacePlaceholders(templateBody, placeholders);
    }

    /**
     * Gets the email subject for a notification, using template if specified or
     * default template.
     *
     * @param instituteId  Institute ID for template lookup
     * @param templateName Optional template name (if null, uses default)
     * @param context      Enrollment context for placeholder values
     * @return Email subject with placeholders replaced
     */
    public String getEmailSubject(String instituteId, String templateName, EnrolmentContext context) {
        String templateSubject = getTemplateSubject(instituteId, templateName);
        Map<String, String> placeholders = buildPlaceholders(context);
        return replacePlaceholders(templateSubject, placeholders);
    }

    /**
     * Gets template body from Templates table or returns default.
     */
    private String getTemplateBody(String instituteId, String templateName) {
        if (!StringUtils.hasText(templateName)) {
            log.debug("No template name provided, using default template");
            return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_BODY;
        }

        try {
            Template template = templateRepository
                    .findByInstituteIdAndNameAndTypeAndStatus(instituteId, templateName, NotificationType.EMAIL.name(), StatusEnum.ACTIVE.name())
                    .orElse(null);

            if (template == null || !StringUtils.hasText(template.getContent())) {
                log.warn("Template not found or empty: {} for institute: {}, using default", templateName, instituteId);
                return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_BODY;
            }

            log.debug("Using template: {} for institute: {}", templateName, instituteId);
            return template.getContent();
        } catch (Exception e) {
            log.error("Error fetching template: {} for institute: {}, using default", templateName, instituteId, e);
            return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_BODY;
        }
    }

    /**
     * Gets template subject from Templates table or returns default.
     */
    private String getTemplateSubject(String instituteId, String templateName) {
        if (!StringUtils.hasText(templateName)) {
            log.debug("No template name provided, using default subject");
            return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_SUBJECT;
        }

        try {
            Template template = templateRepository
                    .findByInstituteIdAndNameAndTypeAndStatus(instituteId, templateName, NotificationType.EMAIL.name(),StatusEnum.ACTIVE.name())
                    .orElse(null);

            if (template == null || !StringUtils.hasText(template.getSubject())) {
                log.warn("Template not found or subject empty: {} for institute: {}, using default", templateName,
                        instituteId);
                return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_SUBJECT;
            }

            log.debug("Using template subject: {} for institute: {}", templateName, instituteId);
            return template.getSubject();
        } catch (Exception e) {
            log.error("Error fetching template subject: {} for institute: {}, using default", templateName, instituteId,
                    e);
            return EnrollmentTemplateConstants.DEFAULT_EXPIRY_TEMPLATE_SUBJECT;
        }
    }

    /**
     * Builds placeholder map from enrollment context.
     */
    private Map<String, String> buildPlaceholders(EnrolmentContext context) {
        Map<String, String> placeholders = new HashMap<>();

        // Learner name
        UserDTO user = context.getUser();
        String learnerName = (user != null && StringUtils.hasText(user.getFullName()))
                ? user.getFullName()
                : "Learner";
        placeholders.put("learner_name", learnerName);

        // Course name - format: levelName (if not DEFAULT) + packageName + sessionName
        // (if not DEFAULT)
        String courseName = formatCourseName(context.getMapping().getPackageSession());
        placeholders.put("course_name", courseName);

        // Expiry date
        Date expiryDate = context.getEndDate();
        String expiryDateStr = (expiryDate != null)
                ? new SimpleDateFormat("yyyy-MM-dd").format(expiryDate)
                : "N/A";
        placeholders.put("expiry_date", expiryDateStr);

        // Renewal link (hardcoded for now)
        placeholders.put("renewal_link", EnrollmentTemplateConstants.DEFAULT_RENEWAL_LINK);

        return placeholders;
    }

    /**
     * Formats course name from package session.
     * Format: levelName (if levelId != "DEFAULT") + packageName + sessionName (if
     * sessionId != "DEFAULT")
     */
    public String formatCourseName(PackageSession packageSession) {
        if (packageSession == null) {
            return "Course";
        }

        StringBuilder sb = new StringBuilder();

        // Level name (skip if DEFAULT)
        if (packageSession.getLevel() != null
                && !"DEFAULT".equalsIgnoreCase(packageSession.getLevel().getId())
                && StringUtils.hasText(packageSession.getLevel().getLevelName())) {
            sb.append(packageSession.getLevel().getLevelName()).append(" - ");
        }

        // Package name
        if (packageSession.getPackageEntity() != null
                && StringUtils.hasText(packageSession.getPackageEntity().getPackageName())) {
            sb.append(packageSession.getPackageEntity().getPackageName());
        }

        // Session name (skip if DEFAULT)
        if (packageSession.getSession() != null
                && !"DEFAULT".equalsIgnoreCase(packageSession.getSession().getId())
                && StringUtils.hasText(packageSession.getSession().getSessionName())) {
            if (!sb.isEmpty()) {
                sb.append(" - ");
            }
            sb.append(packageSession.getSession().getSessionName());
        }

        String result = sb.toString().trim();
        return result.isEmpty() ? "Course" : result;
    }

    /**
     * Replaces placeholders in template string.
     */
    private String replacePlaceholders(String template, Map<String, String> placeholders) {
        if (template == null) {
            return "";
        }

        String result = template;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = (entry.getValue() != null) ? entry.getValue() : "";
            result = result.replace(placeholder, value);
        }

        return result;
    }

    public Template findByNameAndInstituteId(String templateName,String instituteId,String type){
        Optional<Template> byInstituteIdAndNameAndType = templateRepository.findByInstituteIdAndNameAndTypeAndStatus(instituteId, templateName, type,StatusEnum.ACTIVE.name());
        return byInstituteIdAndNameAndType.orElse(null);
    }
}
