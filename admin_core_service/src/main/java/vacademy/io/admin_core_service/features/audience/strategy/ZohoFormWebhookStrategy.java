package vacademy.io.admin_core_service.features.audience.strategy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.dto.ProcessedFormDataDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.Map;

/**
 * Strategy implementation for Zoho Forms webhook processing
 * 
 * Zoho Forms webhook payload structure example:
 * {
 *   "Email": "john@example.com",
 *   "Name": "John Doe",
 *   "Phone Number": "1234567890",
 *   "Company": "Acme Corp",
 *   ... other fields
 * }
 */
@Component
public class ZohoFormWebhookStrategy implements FormWebhookStrategy {
    
    private static final Logger logger = LoggerFactory.getLogger(ZohoFormWebhookStrategy.class);
    
    @Override
    public ProcessedFormDataDTO processWebhookPayload(Map<String, Object> payload) {
        logger.info("Processing Zoho Forms webhook payload");
        
        if (payload == null || payload.isEmpty()) {
            throw new VacademyException("Zoho Forms webhook payload is empty");
        }
        
        Map<String, String> formFields = new HashMap<>();
        String email = null;
        String firstName = null;
        String lastName = null;
        String fullName = null;
        String phone = null;
        String phoneFieldName = null; // Track which field contained the phone
        
        // Process each field in the payload
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            String fieldName = entry.getKey();
            Object fieldValue = entry.getValue();
            
            if (fieldValue == null) {
                continue;
            }
            
            String value = fieldValue.toString().trim();
            
            if (!StringUtils.hasText(value)) {
                continue;
            }
            
            // Store the field with its name
            formFields.put(fieldName, value);
            
            // Extract common fields based on field name patterns
            String fieldNameLower = fieldName.toLowerCase();
            
            // Email detection
            if (email == null && (fieldNameLower.contains("email") || fieldNameLower.equals("e-mail"))) {
                email = value;
                logger.debug("Detected email field: {} = {}", fieldName, email);
            }
            
            // Name detection
            if (fullName == null && fieldNameLower.equals("full name")) {
                fullName = value;
                logger.debug("Detected full name field: {} = {}", fieldName, fullName);
            } else if (firstName == null && fieldNameLower.contains("first name")) {
                firstName = value;
                logger.debug("Detected first name field: {} = {}", fieldName, firstName);
            } else if (lastName == null && fieldNameLower.contains("last name")) {
                lastName = value;
                logger.debug("Detected last name field: {} = {}", fieldName, lastName);
            }
            
            // Phone detection
            if (phone == null && (fieldNameLower.contains("phone") || fieldNameLower.contains("mobile") 
                    || fieldNameLower.contains("contact"))) {
                phone = value;
                phoneFieldName = fieldName; // Remember the original field name
                logger.debug("Detected phone field: {} = {}", fieldName, phone);
            }
        }
        
        // Format phone number: append 91 if length is 10
        if (StringUtils.hasText(phone)) {
            String cleanedPhone = phone.replaceAll("[^0-9]", ""); // Remove non-numeric characters
            if (cleanedPhone.length() == 10) {
                phone = "91" + cleanedPhone;
                logger.debug("Appended country code to 10-digit phone: {}", phone);
                
                // Update the formFields map with formatted phone number
                if (phoneFieldName != null) {
                    formFields.put(phoneFieldName, phone);
                    logger.debug("Updated formFields with formatted phone for field: {}", phoneFieldName);
                }
            } else {
                phone = cleanedPhone;
                
                // Update the formFields map with cleaned phone number
                if (phoneFieldName != null) {
                    formFields.put(phoneFieldName, phone);
                }
            }
        }
        
        // Construct full name if not directly provided
        if (fullName == null) {
            if (firstName != null && lastName != null) {
                fullName = firstName + " " + lastName;
                logger.debug("Constructed full name from first and last: {}", fullName);
            } else if (firstName != null) {
                fullName = firstName;
                logger.debug("Using first name as full name: {}", fullName);
            } else if (lastName != null) {
                fullName = lastName;
                logger.debug("Using last name as full name: {}", fullName);
            }
        }
        
        logger.info("Processed {} fields from Zoho Forms webhook", formFields.size());
        
        return ProcessedFormDataDTO.builder()
                .formFields(formFields)
                .email(email)
                .fullName(fullName)
                .phone(phone)
                .build();
    }
    
    @Override
    public boolean validatePayload(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            logger.warn("Zoho Forms webhook payload is null or empty");
            return false;
        }
        
        // Zoho Forms sends field names as keys directly
        // At minimum, we should have at least one field
        logger.info("Zoho Forms webhook payload validation passed with {} fields", payload.size());
        return true;
    }
    
    @Override
    public String getProviderName() {
        return "ZOHO_FORMS";
    }
}
