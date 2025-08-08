package vacademy.io.notification_service.features.announcements.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import lombok.extern.slf4j.Slf4j;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Validator for mode-specific settings
 */
@Slf4j
public class ModeSettingsValidator implements ConstraintValidator<ValidModeSettings, Map<String, Object>> {

    @Override
    public void initialize(ValidModeSettings constraintAnnotation) {
        // Initialization if needed
    }

    @Override
    public boolean isValid(Map<String, Object> settings, ConstraintValidatorContext context) {
        if (settings == null || settings.isEmpty()) {
            return true; // Allow empty settings
        }

        try {
            // Basic validation - check for required fields based on mode type
            String modeType = (String) settings.get("modeType");
            
            if (modeType == null) {
                addConstraintViolation(context, "Mode type is required in settings");
                return false;
            }

            // Mode-specific validation
            switch (modeType.toUpperCase()) {
                case "RESOURCES":
                    return validateResourcesSettings(settings, context);
                case "DASHBOARD_PIN":
                    return validateDashboardPinSettings(settings, context);
                case "COMMUNITY":
                    return validateCommunitySettings(settings, context);
                case "STREAM":
                    return validateStreamSettings(settings, context);
                case "TASKS":
                    return validateTasksSettings(settings, context);
                default:
                    return true; // Allow other modes without specific validation
            }
            
        } catch (Exception e) {
            log.warn("Error validating mode settings: {}", e.getMessage());
            addConstraintViolation(context, "Invalid settings format");
            return false;
        }
    }

    private boolean validateResourcesSettings(Map<String, Object> settings, ConstraintValidatorContext context) {
        String folderName = (String) settings.get("folderName");
        if (folderName == null || folderName.trim().isEmpty()) {
            addConstraintViolation(context, "Folder name is required for RESOURCES mode");
            return false;
        }
        return true;
    }

    private boolean validateDashboardPinSettings(Map<String, Object> settings, ConstraintValidatorContext context) {
        Object durationHours = settings.get("durationHours");
        if (durationHours != null) {
            try {
                int duration = Integer.parseInt(durationHours.toString());
                if (duration <= 0 || duration > 168) { // Max 1 week
                    addConstraintViolation(context, "Duration must be between 1 and 168 hours");
                    return false;
                }
            } catch (NumberFormatException e) {
                addConstraintViolation(context, "Duration must be a valid number");
                return false;
            }
        }
        return true;
    }

    private boolean validateCommunitySettings(Map<String, Object> settings, ConstraintValidatorContext context) {
        String communityType = (String) settings.get("communityType");
        if (communityType != null && !isValidCommunityType(communityType)) {
            addConstraintViolation(context, "Invalid community type");
            return false;
        }
        return true;
    }

    private boolean validateStreamSettings(Map<String, Object> settings, ConstraintValidatorContext context) {
        String streamType = (String) settings.get("streamType");
        if (streamType != null && !isValidStreamType(streamType)) {
            addConstraintViolation(context, "Invalid stream type");
            return false;
        }
        return true;
    }

    private boolean validateTasksSettings(Map<String, Object> settings, ConstraintValidatorContext context) {
        // Validate required fields for TASKS mode
        
        // slideIds is required and must be non-empty
        Object slideIdsObj = settings.get("slideIds");
        if (slideIdsObj == null) {
            addConstraintViolation(context, "slideIds is required for TASKS mode");
            return false;
        }
        
        if (slideIdsObj instanceof List) {
            @SuppressWarnings("unchecked")
            List<String> slideIds = (List<String>) slideIdsObj;
            if (slideIds.isEmpty()) {
                addConstraintViolation(context, "slideIds cannot be empty for TASKS mode");
                return false;
            }
        } else {
            addConstraintViolation(context, "slideIds must be a list for TASKS mode");
            return false;
        }
        
        // goLiveDateTime is required
        Object goLiveDateTimeObj = settings.get("goLiveDateTime");
        if (goLiveDateTimeObj == null) {
            addConstraintViolation(context, "goLiveDateTime is required for TASKS mode");
            return false;
        }
        
        // deadlineDateTime is required
        Object deadlineDateTimeObj = settings.get("deadlineDateTime");
        if (deadlineDateTimeObj == null) {
            addConstraintViolation(context, "deadlineDateTime is required for TASKS mode");
            return false;
        }
        
        // Validate datetime format if they are strings
        if (goLiveDateTimeObj instanceof String) {
            try {
                LocalDateTime.parse((String) goLiveDateTimeObj);
            } catch (Exception e) {
                addConstraintViolation(context, "Invalid goLiveDateTime format. Expected ISO LocalDateTime format.");
                return false;
            }
        }
        
        if (deadlineDateTimeObj instanceof String) {
            try {
                LocalDateTime.parse((String) deadlineDateTimeObj);
            } catch (Exception e) {
                addConstraintViolation(context, "Invalid deadlineDateTime format. Expected ISO LocalDateTime format.");
                return false;
            }
        }
        
        // Validate status if provided
        Object statusObj = settings.get("status");
        if (statusObj != null && !isValidTaskStatus((String) statusObj)) {
            addConstraintViolation(context, "Invalid task status");
            return false;
        }
        
        return true;
    }

    private boolean isValidCommunityType(String communityType) {
        return communityType.matches("^(DISCUSSION|ANNOUNCEMENT|QNA|GENERAL)$");
    }

    private boolean isValidStreamType(String streamType) {
        return streamType.matches("^(LIVE_CLASS|RECORDED_CLASS|ASSIGNMENT|QUIZ|GENERAL)$");
    }

    private boolean isValidTaskStatus(String taskStatus) {
        return taskStatus.matches("^(DRAFT|SCHEDULED|LIVE|COMPLETED|OVERDUE|CANCELLED)$");
    }

    private void addConstraintViolation(ConstraintValidatorContext context, String message) {
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(message).addConstraintViolation();
    }
}