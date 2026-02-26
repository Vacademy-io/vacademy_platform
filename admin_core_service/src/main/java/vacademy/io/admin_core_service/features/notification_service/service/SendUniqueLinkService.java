package vacademy.io.admin_core_service.features.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.learner.utility.TemplateReader;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationTemplateVariables;
import vacademy.io.admin_core_service.features.institute.entity.Template;
import vacademy.io.admin_core_service.features.institute.repository.TemplateRepository;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification_service.enums.CommunicationType;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.lang.reflect.Field;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;

@Component
public class SendUniqueLinkService {
    @Autowired
    private InstituteService service;

    @Autowired
    private NotificationService notificationService;
    @Autowired
    private TemplateReader templateReader;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TemplateRepository templateRepository;

    @Autowired
    private vacademy.io.admin_core_service.features.user_subscription.service.CouponCodeService couponCodeService;

    @Autowired
    private vacademy.io.admin_core_service.features.learner.service.LearnerInvitationLinkService learnerInvitationLinkService;

    /**
     * Convert NotificationTemplateVariables to a generic map for template
     * placeholders
     * This method uses reflection to dynamically extract all fields and their
     * values
     * Special handling for customFields Map to expand nested key-value pairs
     */
    private Map<String, String> convertTemplateVariablesToMap(NotificationTemplateVariables templateVars) {
        Map<String, String> placeholders = new HashMap<>();

        if (templateVars == null) {
            return placeholders;
        }

        try {
            Field[] fields = NotificationTemplateVariables.class.getDeclaredFields();
            for (Field field : fields) {
                field.setAccessible(true);
                Object value = field.get(templateVars);

                if (value != null) {
                    // Special handling for customFields Map
                    if (field.getName().equals("customFields") && value instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, String> customFieldsMap = (Map<String, String>) value;

                        // Generate HTML for all custom fields
                        String customFieldsHtml = generateCustomFieldsHtml(customFieldsMap);
                        placeholders.put("customFieldsHtml", customFieldsHtml);

                        // Add each custom field with "customFields." prefix for template access
                        for (Map.Entry<String, String> entry : customFieldsMap.entrySet()) {
                            if (entry.getValue() != null && !entry.getValue().trim().isEmpty()) {
                                // Allow access as: {{customFields.Phone Number}}
                                placeholders.put("customFields." + entry.getKey(), entry.getValue());

                                // Also add snake_case version for flexibility: {{custom_fields_phone_number}}
                                String snakeCaseKey = "custom_fields_" +
                                        entry.getKey().toLowerCase().replaceAll("[^a-z0-9]+", "_");
                                placeholders.put(snakeCaseKey, entry.getValue());
                            }
                        }
                    } else {
                        // Standard field mapping
                        String stringValue = value.toString();
                        placeholders.put(field.getName(), stringValue);

                        // Automatic camelCase to snake_case conversion
                        // e.g. applicantId -> applicant_id
                        String snakeCase = field.getName().replaceAll("([a-z])([A-Z]+)", "$1_$2").toLowerCase();
                        if (!snakeCase.equals(field.getName())) {
                            placeholders.put(snakeCase, stringValue);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Log error but don't fail the notification
            System.err.println("Error converting template variables to map: " + e.getMessage());
            e.printStackTrace();
        }

        // Debug logging
        // System.out.println("Template Variables Map: " + placeholders);
        if (placeholders.containsKey("applicantId") || placeholders.containsKey("applicant_id")) {
            System.out.println("DEBUG: Applicant ID present in vars: " + placeholders.get("applicant_id"));
        } else {
            System.out.println("DEBUG: Applicant ID MISSING from vars");
        }

        return placeholders;
    }

    /**
     * Generate HTML for custom fields dynamically
     * Creates formatted HTML with detail-item divs for each custom field
     */
    private String generateCustomFieldsHtml(Map<String, String> customFields) {
        if (customFields == null || customFields.isEmpty()) {
            return "<p style='color: #6c757d; font-style: italic;'>No additional information provided.</p>";
        }

        StringBuilder html = new StringBuilder();

        for (Map.Entry<String, String> entry : customFields.entrySet()) {
            String fieldName = entry.getKey();
            String fieldValue = entry.getValue();

            if (fieldValue != null && !fieldValue.trim().isEmpty()) {
                html.append("<div class=\"detail-item\">");
                html.append("<span class=\"detail-label\">").append(escapeHtml(fieldName)).append(":</span>");
                html.append("<span class=\"detail-value\">").append(escapeHtml(fieldValue)).append("</span>");
                html.append("</div>");
            }
        }

        return html.toString();
    }

    /**
     * Escape HTML special characters to prevent XSS
     */
    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
    }

    /**
     * Parse dynamic parameters from template's JSON string
     */
    private Map<String, String> parseDynamicParameters(String dynamicParametersJson) {
        Map<String, String> params = new HashMap<>();
        if (dynamicParametersJson != null && !dynamicParametersJson.trim().isEmpty()) {
            try {
                Map<String, Object> jsonParams = objectMapper.readValue(dynamicParametersJson,
                        new TypeReference<Map<String, Object>>() {
                        });
                for (Map.Entry<String, Object> entry : jsonParams.entrySet()) {
                    params.put(entry.getKey(), entry.getValue() != null ? entry.getValue().toString() : "");
                }
            } catch (Exception e) {
                System.err.println("Error parsing dynamic parameters JSON: " + e.getMessage());
            }
        }
        return params;
    }

    /**
     * Merge template dynamic parameters with user-specific values
     * Template parameters that are empty will be filled with user data
     * Template parameters that already have values will be kept as-is
     * Now includes campaignName and all custom fields from customFields map
     */
    private Map<String, String> mergeTemplateParameters(Template template, NotificationTemplateVariables userVars) {
        Map<String, String> mergedParams = new HashMap<>();

        // Parse template's dynamic parameters from JSON string
        Map<String, String> templateParams = parseDynamicParameters(template.getDynamicParameters());
        mergedParams.putAll(templateParams);

        // Override empty parameters with user-specific values
        if (userVars != null) {
            Map<String, String> userParams = convertTemplateVariablesToMap(userVars);

            // Map common template parameter names to user data
            if (isEmpty(mergedParams.get("name"))) {
                mergedParams.put("name", userParams.getOrDefault("userFullName", ""));
            }
            if (isEmpty(mergedParams.get("user_name"))) {
                mergedParams.put("user_name", userParams.getOrDefault("userName", ""));
            }
            if (isEmpty(mergedParams.get("user_email"))) {
                mergedParams.put("user_email", userParams.getOrDefault("userEmail", ""));
            }
            if (isEmpty(mergedParams.get("user_mobile"))) {
                mergedParams.put("user_mobile", userParams.getOrDefault("userMobile", ""));
            }
            if (isEmpty(mergedParams.get("user_full_name"))) {
                mergedParams.put("user_full_name", userParams.getOrDefault("userFullName", ""));
            }
            if (isEmpty(mergedParams.get("package_name"))) {
                mergedParams.put("package_name", userParams.getOrDefault("packageName", ""));
            }
            if (isEmpty(mergedParams.get("institute_name"))) {
                mergedParams.put("institute_name", userParams.getOrDefault("instituteName", ""));
            }
            if (isEmpty(mergedParams.get("institute_id"))) {
                mergedParams.put("institute_id", userParams.getOrDefault("instituteId", ""));
            }
            if (isEmpty(mergedParams.get("payment_type"))) {
                mergedParams.put("payment_type", userParams.getOrDefault("paymentType", ""));
            }
            if (isEmpty(mergedParams.get("payment_amount"))) {
                mergedParams.put("payment_amount", userParams.getOrDefault("paymentAmount", ""));
            }
            if (isEmpty(mergedParams.get("payment_status"))) {
                mergedParams.put("payment_status", userParams.getOrDefault("paymentStatus", ""));
            }
            if (isEmpty(mergedParams.get("enroll_invite_code"))) {
                mergedParams.put("enroll_invite_code", userParams.getOrDefault("enrollInviteCode", ""));
            }
            if (isEmpty(mergedParams.get("level_name"))) {
                mergedParams.put("level_name", userParams.getOrDefault("levelName", ""));
            }
            if (isEmpty(mergedParams.get("session_name"))) {
                mergedParams.put("session_name", userParams.getOrDefault("sessionName", ""));
            }

            // Referral template variables
            if (isEmpty(mergedParams.get("referral_link"))) {
                mergedParams.put("referral_link", userParams.getOrDefault("referralLink", ""));
            }
            if (isEmpty(mergedParams.get("short_referral_link"))) {
                mergedParams.put("short_referral_link", userParams.getOrDefault("shortReferralLink", ""));
            }
            if (isEmpty(mergedParams.get("invite_code"))) {
                mergedParams.put("invite_code", userParams.getOrDefault("inviteCode", ""));
            }
            if (isEmpty(mergedParams.get("theme_color"))) {
                mergedParams.put("theme_color", userParams.getOrDefault("themeColor", ""));
            }
            if (isEmpty(mergedParams.get("ref_code"))) {
                mergedParams.put("ref_code", userParams.getOrDefault("refCode", ""));
            }

            // NEW: Audience campaign variables
            if (isEmpty(mergedParams.get("campaign_name"))) {
                mergedParams.put("campaign_name", userParams.getOrDefault("campaignName", ""));
            }
            if (isEmpty(mergedParams.get("campaignName"))) {
                mergedParams.put("campaignName", userParams.getOrDefault("campaignName", ""));
            }

            // NEW: Add template-specific mappings for camelCase variables
            if (isEmpty(mergedParams.get("userFullName"))) {
                mergedParams.put("userFullName", userParams.getOrDefault("userFullName", ""));
            }
            if (isEmpty(mergedParams.get("userEmail"))) {
                mergedParams.put("userEmail", userParams.getOrDefault("userEmail", ""));
            }
            if (isEmpty(mergedParams.get("userMobile"))) {
                mergedParams.put("userMobile", userParams.getOrDefault("userMobile", ""));
            }
            if (isEmpty(mergedParams.get("submissionTime"))) {
                mergedParams.put("submissionTime", userParams.getOrDefault("submissionTime", ""));
            }
            if (isEmpty(mergedParams.get("customFieldsHtml"))) {
                mergedParams.put("customFieldsHtml", userParams.getOrDefault("customFieldsHtml", ""));
            }

            // NEW: Family and Payment details
            if (isEmpty(mergedParams.get("parent_name"))) {
                mergedParams.put("parent_name", userParams.getOrDefault("parentName", ""));
            }
            if (isEmpty(mergedParams.get("child_name"))) {
                mergedParams.put("child_name", userParams.getOrDefault("childName", ""));
            }
            if (isEmpty(mergedParams.get("payment_link"))) {
                mergedParams.put("payment_link", userParams.getOrDefault("paymentLink", ""));
            }
            if (isEmpty(mergedParams.get("applicant_id"))) {
                mergedParams.put("applicant_id", userParams.getOrDefault("applicantId", ""));
            }

            // NEW: Add all custom fields from userParams (already expanded by
            // convertTemplateVariablesToMap)
            // This includes both "customFields.Field Name" and "custom_fields_field_name"
            // formats
            for (Map.Entry<String, String> entry : userParams.entrySet()) {
                String key = entry.getKey();
                // Add custom field mappings if they don't already exist
                if (key.startsWith("customFields.") || key.startsWith("custom_fields_")
                        || key.equals("customFieldsHtml")) {
                    if (isEmpty(mergedParams.get(key))) {
                        mergedParams.put(key, entry.getValue());
                    }
                }
            }

            // Add unique_link if not present
            if (isEmpty(mergedParams.get("unique_link"))) {
                // This will be set later with the actual dashboard URL
                mergedParams.put("unique_link", "");
            }
        }

        return mergedParams;
    }

    /**
     * Check if a string is null or empty
     */
    private boolean isEmpty(String value) {
        return value == null || value.trim().isEmpty();
    }

    /**
     * Replace placeholders in template content with actual values
     */
    private String replaceTemplatePlaceholders(String content, Map<String, String> parameters) {
        if (content == null || parameters == null) {
            return content;
        }

        String result = content;
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            String placeholder = "{{" + entry.getKey() + "}}";
            String value = entry.getValue() != null ? entry.getValue() : "";
            result = result.replace(placeholder, value);
        }

        return result;
    }

    /**
     * Send email using existing Template entity with dynamic parameter merging
     */
    public void sendEmailWithTemplate(String instituteId, UserDTO user, Template template,
            NotificationTemplateVariables userVars) {
        Institute institute = service.findById(instituteId);
        if (institute != null && template != null) {

            // Merge template parameters with user-specific values
            Map<String, String> mergedParams = mergeTemplateParameters(template, userVars);

            // Replace placeholders in template content
            String processedContent = replaceTemplatePlaceholders(template.getContent(), mergedParams);
            String processedSubject = replaceTemplatePlaceholders(template.getSubject(), mergedParams);

            // Create notification
            NotificationDTO notificationDTO = new NotificationDTO();
            notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
            notificationDTO.setBody(processedContent);
            notificationDTO.setSubject(processedSubject);

            NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
            notificationToUserDTO.setUserId(user.getId());
            notificationToUserDTO.setChannelId(user.getEmail());
            notificationToUserDTO.setPlaceholders(mergedParams); // Keep for any additional processing

            notificationDTO.setUsers(List.of(notificationToUserDTO));
            notificationService.sendEmailToUsers(notificationDTO, instituteId);
        }
    }

    public void sendUniqueLinkByEmailByEnrollInvite(String instituteId, UserDTO user, String templateId,
            EnrollInvite enrollInvite, NotificationTemplateVariables templateVars) {
        Institute institute = service.findById(instituteId);
        if (institute != null) {
            // Fetch the actual Template entity instead of using templateReader
            Template template = templateRepository.findById(templateId)
                    .orElseThrow(() -> new RuntimeException("Template not found with ID: " + templateId));

            // Use the Template entity with dynamic parameter merging
            sendEmailWithTemplate(instituteId, user, template, templateVars);
        }
    }

    /**
     * Send WhatsApp with dynamic template variables using Template entity
     */
    public void sendUniqueLinkByWhatsApp(String instituteId, UserDTO user, String templateId,
            NotificationTemplateVariables templateVars) {
        Institute institute = service.findById(instituteId);
        if (institute != null) {
            // Fetch the actual Template entity instead of using templateReader
            Template template = templateRepository.findById(templateId)
                    .orElseThrow(() -> new RuntimeException("Template not found with ID: " + templateId));

            // Merge template parameters with user variables
            Map<String, String> mergedParams = mergeTemplateParameters(template, templateVars);
            String templateName = template.getName() != null ? template.getName().trim() : "";
            String languageCode = "en";
            Map<String, String> finalParamMap = new HashMap<>();
            // Use only keys present in dynamic_parameters for the outgoing payload
            Map<String, String> dynamicParams = parseDynamicParameters(template.getDynamicParameters());
            if (dynamicParams != null && !dynamicParams.isEmpty()) {
                // language_code override if provided in dynamic params
                if (dynamicParams.containsKey("language_code")
                        && StringUtils.hasText(dynamicParams.get("language_code"))) {
                    languageCode = dynamicParams.get("language_code");
                }
                for (Map.Entry<String, String> entry : dynamicParams.entrySet()) {
                    String key = entry.getKey();
                    if (!StringUtils.hasText(key))
                        continue;
                    // Prefer merged (user/event) value, else template default
                    String value = mergedParams.get(key);
                    if (!StringUtils.hasText(value))
                        value = entry.getValue();
                    finalParamMap.put(key, value != null ? value : "");
                }
            } else {
                finalParamMap.put("name", mergedParams.getOrDefault("name", user.getFullName()));
            }

            // Build request for notification-service
            WhatsappRequest request = new WhatsappRequest();
            request.setTemplateName(templateName);
            request.setLanguageCode(languageCode);

            // Sanitize mobile number: remove +, spaces, and non-numeric characters
            String sanitizedMobile = user.getMobileNumber();
            if (sanitizedMobile != null) {
                sanitizedMobile = sanitizedMobile.replaceAll("[^0-9]", "");
            }

            Map<String, Map<String, String>> singleUser = new HashMap<>();
            singleUser.put(sanitizedMobile, finalParamMap);
            request.setUserDetails(List.of(singleUser));

            // Dispatch to notification-service
            notificationService.sendWhatsappToUsers(request, instituteId);
        }
    }
}
