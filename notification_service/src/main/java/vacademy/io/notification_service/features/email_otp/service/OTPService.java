package vacademy.io.notification_service.features.email_otp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.notification_service.features.email_otp.entity.EmailOtp;
import vacademy.io.notification_service.features.email_otp.repository.OtpRepository;
import vacademy.io.notification_service.service.EmailService;
import vacademy.io.notification_service.service.WhatsAppService;
import vacademy.io.notification_service.client.AdminTemplateClient;
import vacademy.io.notification_service.dto.WhatsAppTemplateConfigDTO;
import vacademy.io.notification_service.constants.NotificationEventType;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Service
@Slf4j
public class OTPService {

    @Autowired
    OtpRepository otpRepository;

    @Autowired
    EmailService emailService;

    @Autowired
    WhatsAppService whatsAppService;

    @Autowired
    AdminTemplateClient adminTemplateClient;

    public static String generateOTP(int length) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < length; i++) {
            otp.append(random.nextInt(10));
        }
        return otp.toString();
    }

    public Boolean sendEmailOtp(String to, String subject, String service, String name, String instituteId) {
        EmailOtp otp = createNewOTP(to, service);
        try {
            emailService.sendEmailOtp(to, subject, service, name, otp.getOtp(), instituteId);
        } catch (Exception e) {
            return false;
        }
        return true;
    }

    public Boolean verifyEmailOtp(String otp, String email) {
        Optional<EmailOtp> otpOptional = otpRepository.findTopByEmailOrderByCreatedAtDesc(email);

        if (otpOptional.isPresent()) {
            EmailOtp emailOtp = otpOptional.get();

            // Check expiration (10 minutes = 600000 ms)
            long now = System.currentTimeMillis();
            long createdAt = emailOtp.getCreatedAt().getTime();
            if (now - createdAt > 10 * 60 * 1000) {
                throw new VacademyException("OTP has expired. Please request a new one.");
            }
            // Validate OTP
            if (emailOtp.getOtp().equals(otp)) {
                emailOtp.setIsVerified("true");
                otpRepository.save(emailOtp);
                return true;
            }
        }

        return false;
    }

    /**
     * Send WhatsApp OTP
     * 
     * @param phoneNumber Phone number with country code (e.g., +919876543210)
     * @param service     Service name
     * @return true if OTP sent successfully
     */
    public Boolean sendWhatsAppOtp(String phoneNumber, String service) {
        EmailOtp otp = createNewWhatsAppOTP(phoneNumber, service);
        try {
            // Default template configuration (fallback if database lookup fails)
            String templateName = "";
            String languageCode = "";
            WhatsAppTemplateConfigDTO templateConfig = null;

            // Try to fetch institute-specific template if institute ID is provided
            if (service != null && !service.isBlank()) {
                try {
                    log.info("Fetching WhatsApp template for institute: {}, event: {}",
                            service, NotificationEventType.OTP_REQUEST.getEventName());
                    templateConfig = adminTemplateClient.getWhatsAppTemplate(
                            NotificationEventType.OTP_REQUEST.getEventName(), service);

                    if (templateConfig != null && templateConfig.getTemplateName() != null
                            && !templateConfig.getTemplateName().isBlank()) {
                        templateName = templateConfig.getTemplateName();
                        languageCode = templateConfig.getLanguageCode() != null
                                && !templateConfig.getLanguageCode().isBlank()
                                        ? templateConfig.getLanguageCode()
                                        : "en";
                        log.info("Using institute-specific template: {} with language: {} for institute: {}",
                                templateName, languageCode, service);
                    } else {
                        log.warn("No template found for institute {}, using default template: {} with language: {}",
                                service, templateName, languageCode);
                    }
                } catch (Exception e) {
                    log.warn("Failed to fetch template for institute {}, using default template: {}. Error: {}",
                            service, templateName, e.getMessage());
                }
            } else {
                log.info("No institute ID provided, using default template: {} with language: {}",
                        templateName, languageCode);
            }

            // Prepare context for dynamic parameters
            Map<String, String> contextValues = new HashMap<>();
            contextValues.put("otp", otp.getOtp());
            contextValues.put("phone_number", phoneNumber);

            // Prepare parameters for WhatsApp template
            Map<String, String> params = new HashMap<>();
            Map<String, String> buttonParamMap = new HashMap<>();

            if (templateConfig != null && templateConfig.getParameterConfig() != null) {
                // Dynamic parameter generation from institute-specific config
                params = buildParameters(templateConfig.getParameterConfig().getBody(), contextValues);
                buttonParamMap = buildParameters(templateConfig.getParameterConfig().getButton(), contextValues);
                log.debug("Using dynamic parameters from institute config");
            } else {
                // Fallback to default parameter mapping
                params.put("1", otp.getOtp());
                buttonParamMap.put("1", otp.getOtp());
                log.debug("Using default parameter mapping");
            }

            List<Map<String, Map<String, String>>> bodyParams = new ArrayList<>();
            Map<String, Map<String, String>> userDetail = new HashMap<>();
            userDetail.put(phoneNumber, params);
            bodyParams.add(userDetail);

            // Button parameters for URL button
            Map<String, Map<String, String>> buttonParams = new HashMap<>();
            buttonParams.put(phoneNumber, buttonParamMap);

            // Send via WhatsApp using template (dynamic or default)
            List<Map<String, Boolean>> results = whatsAppService.sendWhatsappMessages(
                    templateName, // Template name (dynamic or hardcoded)
                    bodyParams,
                    null, // No header params
                    languageCode, // Language code (dynamic or hardcoded)
                    null, // No header type
                    service, // Institute ID
                    buttonParams // Button parameters for URL
            );

            if (results != null && !results.isEmpty()) {
                Map<String, Boolean> result = results.get(0);
                return result.getOrDefault(phoneNumber, false);
            }

            log.warn("WhatsApp OTP send returned null or empty results for: {}", phoneNumber);
            return false;

        } catch (Exception e) {
            log.error("Error sending WhatsApp OTP to {}: {}", phoneNumber, e.getMessage(), e);
            return false;
        }
    }

    /**
     * Verify WhatsApp OTP
     * 
     * @param otp         OTP code
     * @param phoneNumber Phone number
     * @return true if OTP is valid
     */
    public Boolean verifyWhatsAppOtp(String otp, String phoneNumber) {
        Optional<EmailOtp> otpOptional = otpRepository.findTopByPhoneNumberAndTypeOrderByCreatedAtDesc(phoneNumber,
                "WHATSAPP");

        if (otpOptional.isPresent()) {
            EmailOtp whatsappOtp = otpOptional.get();

            // Check expiration (10 minutes = 600000 ms)
            long now = System.currentTimeMillis();
            long createdAt = whatsappOtp.getCreatedAt().getTime();
            if (now - createdAt > 10 * 60 * 1000) {
                throw new VacademyException("OTP has expired. Please request a new one.");
            }

            // Validate OTP
            if (whatsappOtp.getOtp().equals(otp)) {
                whatsappOtp.setIsVerified("true");
                otpRepository.save(whatsappOtp);
                return true;
            }
        }

        return false;
    }

    EmailOtp createNewOTP(String email, String service) {
        EmailOtp otp = EmailOtp.builder()
                .email(email)
                .service(service)
                .type("EMAIL")
                .otp(generateOTP(6))
                .build();
        return otpRepository.save(otp);
    }

    EmailOtp createNewWhatsAppOTP(String phoneNumber, String service) {
        EmailOtp otp = EmailOtp.builder()
                .phoneNumber(phoneNumber)
                .service(service)
                .type("WHATSAPP")
                .otp(generateOTP(6))
                .build();
        return otpRepository.save(otp);
    }

    /**
     * Helper method to build parameters dynamically from template config
     */
    private Map<String, String> buildParameters(List<WhatsAppTemplateConfigDTO.ParameterMapping> mappings,
            Map<String, String> contextValues) {
        Map<String, String> params = new HashMap<>();
        if (mappings == null || mappings.isEmpty()) {
            return params;
        }

        for (WhatsAppTemplateConfigDTO.ParameterMapping mapping : mappings) {
            String value = contextValues.getOrDefault(mapping.getSource(), "");
            params.put(String.valueOf(mapping.getIndex()), value);
        }
        return params;
    }

}
