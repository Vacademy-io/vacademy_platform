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

    /**
     * Convert NotificationTemplateVariables to a generic map for template placeholders
     * This method uses reflection to dynamically extract all fields and their values
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
                    placeholders.put(field.getName(), value.toString());
                }
            }
        } catch (Exception e) {
            // Log error but don't fail the notification
            System.err.println("Error converting template variables to map: " + e.getMessage());
        }

        return placeholders;
    }

    /**
     * Parse dynamic parameters from template's JSON string
     */
    private Map<String, String> parseDynamicParameters(String dynamicParametersJson) {
        Map<String, String> params = new HashMap<>();
        if (dynamicParametersJson != null && !dynamicParametersJson.trim().isEmpty()) {
            try {
                Map<String, Object> jsonParams = objectMapper.readValue(dynamicParametersJson, new TypeReference<Map<String, Object>>() {});
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
            if (isEmpty(mergedParams.get("package_name"))) {
                mergedParams.put("package_name", userParams.getOrDefault("packageName", ""));
            }
            if (isEmpty(mergedParams.get("institute_name"))) {
                mergedParams.put("institute_name", userParams.getOrDefault("instituteName", ""));
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

    public void sendUniqueLinkByEmail(String instituteId, UserDTO user,String templateType){
        Institute institute=service.findById(instituteId);
        if(institute!=null){
            String emailBody = templateReader.getEmailBody(institute.getSetting(),templateType);
            if(emailBody!=null){
                NotificationDTO notificationDTO=new NotificationDTO();
                notificationDTO.setNotificationType(CommunicationType.EMAIL.name());
                notificationDTO.setBody(emailBody);
                notificationDTO.setSubject("Welcome to "+institute.getInstituteName());
                NotificationToUserDTO notificationToUserDTO = new NotificationToUserDTO();
                notificationToUserDTO.setUserId(user.getId());
                notificationToUserDTO.setChannelId(user.getEmail());
                String leanerDashBoardUrl=templateReader.getLearnerDashBoardUrl(institute.getSetting());
                Map<String,String> map=new HashMap<>();
                map.put("name",user.getFullName());
                map.put("unique_link",leanerDashBoardUrl+user.getUsername());
                notificationToUserDTO.setPlaceholders(map);
                notificationDTO.setUsers(List.of(notificationToUserDTO));
                notificationService.sendEmailToUsers(notificationDTO,instituteId);
            }
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
            
            // Add unique link
            String learnerDashBoardUrl = templateReader.getLearnerDashBoardUrl(institute.getSetting());
            if (learnerDashBoardUrl != null) {
                mergedParams.put("unique_link", learnerDashBoardUrl + user.getUsername());
            }
            
            // Send WhatsApp message with processed content
            // Note: You may need to modify templateReader.sendWhatsAppMessage to accept processed content
            templateReader.sendWhatsAppMessage(institute.getSetting(), user, 
                learnerDashBoardUrl + user.getUsername(), instituteId, templateId);
        }
    }
}
