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
 * Generic strategy for processing flat JSON webhook payloads.
 * Works for Facebook Lead Ads (via third-party connectors), custom integrations,
 * or any provider that sends a simple key-value JSON payload.
 *
 * Payload format: { "field1": "value1", "field2": "value2", ... }
 */
@Component
public class GenericFormWebhookStrategy implements FormWebhookStrategy {

    private static final Logger logger = LoggerFactory.getLogger(GenericFormWebhookStrategy.class);

    @Override
    public ProcessedFormDataDTO processWebhookPayload(Map<String, Object> payload) {
        logger.info("Processing generic webhook payload");

        if (payload == null || payload.isEmpty()) {
            throw new VacademyException("Generic webhook payload is empty");
        }

        Map<String, String> formFields = new HashMap<>();
        String email = null;
        String firstName = null;
        String lastName = null;
        String fullName = null;
        String phone = null;
        String phoneFieldName = null;

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

            formFields.put(fieldName, value);

            String fieldNameLower = fieldName.toLowerCase();

            // Email detection
            if (email == null && (fieldNameLower.contains("email") || fieldNameLower.equals("e-mail"))) {
                email = value;
            }

            // Name detection
            if (fullName == null && (fieldNameLower.equals("full name") || fieldNameLower.equals("full_name"))) {
                fullName = value;
            } else if (firstName == null && (fieldNameLower.contains("first name") || fieldNameLower.contains("first_name"))) {
                firstName = value;
            } else if (lastName == null && (fieldNameLower.contains("last name") || fieldNameLower.contains("last_name"))) {
                lastName = value;
            }

            // Phone detection
            if (phone == null && (fieldNameLower.contains("phone") || fieldNameLower.contains("mobile")
                    || fieldNameLower.contains("contact"))) {
                phone = value;
                phoneFieldName = fieldName;
            }
        }

        // Format phone number: append 91 if length is 10
        if (StringUtils.hasText(phone)) {
            String cleanedPhone = phone.replaceAll("[^0-9]", "");
            if (cleanedPhone.length() == 10) {
                phone = "91" + cleanedPhone;
                if (phoneFieldName != null) {
                    formFields.put(phoneFieldName, phone);
                }
            } else {
                phone = cleanedPhone;
                if (phoneFieldName != null) {
                    formFields.put(phoneFieldName, phone);
                }
            }
        }

        // Construct full name
        if (fullName == null) {
            if (firstName != null && lastName != null) {
                fullName = firstName + " " + lastName;
            } else if (firstName != null) {
                fullName = firstName;
            } else if (lastName != null) {
                fullName = lastName;
            }
        }

        logger.info("Processed {} fields from generic webhook", formFields.size());

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
            logger.warn("Generic webhook payload is null or empty");
            return false;
        }
        logger.info("Generic webhook payload validation passed with {} fields", payload.size());
        return true;
    }

    @Override
    public String getProviderName() {
        return "GENERIC";
    }
}
