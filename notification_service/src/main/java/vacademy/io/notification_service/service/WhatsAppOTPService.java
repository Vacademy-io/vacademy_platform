package vacademy.io.notification_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.logging.SentryLogger;
import vacademy.io.notification_service.dto.MetaWhatsAppPayload;
import vacademy.io.notification_service.dto.WhatsAppOTPRequest;
import vacademy.io.notification_service.dto.WhatsAppOTPResponse;
import vacademy.io.notification_service.features.email_otp.entity.EmailOtp;
import vacademy.io.notification_service.features.email_otp.repository.OtpRepository;
import vacademy.io.notification_service.institute.InstituteInternalService;
import vacademy.io.notification_service.institute.InstituteInfoDTO;
import vacademy.io.notification_service.constants.NotificationConstants;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
@Slf4j
public class WhatsAppOTPService {

    @Autowired
    private OtpRepository otpRepository;

    @Autowired
    private InstituteInternalService instituteInternalService;

    @Autowired
    private RestTemplate restTemplate;

    @Value("${meta.whatsapp.api.base.url:https://graph.facebook.com/v22.0}")
    private String metaApiBaseUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Send WhatsApp OTP to the given phone number
     */
    public WhatsAppOTPResponse sendWhatsAppOtp(WhatsAppOTPRequest request) {
        try {
            log.info("Sending WhatsApp OTP to phone: {}, institute: {}", request.getPhoneNumber(),
                    request.getInstituteId());

            // Generate 6-digit OTP
            String otp = generateOTP(6);

            // Store OTP in database
            EmailOtp emailOtp = EmailOtp.builder()
                    .phoneNumber(request.getPhoneNumber())
                    .otp(otp)
                    .service(NotificationConstants.OTP_SERVICE_WHATSAPP_AUTH)
                    .type(NotificationConstants.OTP_TYPE_WHATSAPP)
                    .build();
            otpRepository.save(emailOtp);
            log.info("OTP stored in database for phone: {}", request.getPhoneNumber());

            // Fetch WhatsApp credentials from institute settings
            InstituteInfoDTO institute = instituteInternalService.getInstituteByInstituteId(request.getInstituteId());
            String jsonString = institute.getSetting();
            JsonNode root = objectMapper.readTree(jsonString);

            // Look for WhatsApp credentials in institute settings
            String accessToken = null;
            String phoneNumberId = null;

            // Path 1: setting.WHATSAPP_SETTING.data.UTILITY_WHATSAPP.meta (your actual
            // structure)
            JsonNode whatsappMeta = root.path("setting")
                    .path("WHATSAPP_SETTING")
                    .path("data")
                    .path("UTILITY_WHATSAPP")
                    .path("meta");

            if (!whatsappMeta.isMissingNode()) {
                accessToken = whatsappMeta.path("accessToken").asText();
                phoneNumberId = whatsappMeta.path("appId").asText(); // appId is the phone_number_id
                log.info("Found WhatsApp credentials in WHATSAPP_SETTING.data.UTILITY_WHATSAPP.meta");
            }

            // Path 2: Direct in root (fallback)
            if (accessToken == null || accessToken.isEmpty()) {
                if (root.has("access_token")) {
                    accessToken = root.get("access_token").asText();
                }
                if (root.has("phone_number_id")) {
                    phoneNumberId = root.get("phone_number_id").asText();
                }
            }

            // Path 3: In whatsapp_credentials (fallback)
            if (accessToken == null || accessToken.isEmpty()) {
                if (root.has("whatsapp_credentials")) {
                    JsonNode whatsappCreds = root.get("whatsapp_credentials");
                    if (whatsappCreds.has("access_token")) {
                        accessToken = whatsappCreds.get("access_token").asText();
                    }
                    if (whatsappCreds.has("phone_number_id")) {
                        phoneNumberId = whatsappCreds.get("phone_number_id").asText();
                    }
                }
            }

            // Path 4: Nested path (for backward compatibility with existing institutes)
            if (accessToken == null || accessToken.isEmpty()) {
                JsonNode whatsappSetting = root.path("setting")
                        .path("whatsapp_setting")
                        .path("data")
                        .path("utility_whatsapp");

                if (!whatsappSetting.isMissingNode()) {
                    accessToken = whatsappSetting.path("access_token").asText();
                    phoneNumberId = whatsappSetting.path("phone_number_id").asText();
                }
            }

            if (accessToken == null || accessToken.isEmpty() || phoneNumberId == null || phoneNumberId.isEmpty()) {
                log.error(
                        "WhatsApp credentials not found for institute: {}. Checked paths: WHATSAPP_SETTING.data.UTILITY_WHATSAPP.meta, root level, whatsapp_credentials",
                        request.getInstituteId());
                throw new VacademyException(
                        "WhatsApp credentials not configured for this institute. Please add credentials to institute settings.");
            }

            log.info("WhatsApp credentials found for institute: {}, phoneNumberId: {}", request.getInstituteId(),
                    phoneNumberId);

            // Build Meta API payload
            MetaWhatsAppPayload payload = buildMetaPayload(
                    request.getPhoneNumber(),
                    request.getTemplateName(),
                    request.getLanguageCode(),
                    otp,
                    request.getSettingJson());

            // Call Meta API
            boolean success = callMetaAPI(phoneNumberId, accessToken, payload);

            if (success) {
                log.info("WhatsApp OTP sent successfully to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(true)
                        .message("WhatsApp OTP sent successfully")
                        .otp(otp) // For testing/debugging
                        .build();
            } else {
                log.error("Failed to send WhatsApp OTP to phone: {}", request.getPhoneNumber());
                return WhatsAppOTPResponse.builder()
                        .success(false)
                        .message("Failed to send WhatsApp OTP")
                        .build();
            }

        } catch (Exception e) {
            log.error("Exception while sending WhatsApp OTP: {}", e.getMessage(), e);
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Failed to send WhatsApp OTP")
                    .withTag("notification.type", "WHATSAPP_OTP")
                    .withTag("phone.number", request.getPhoneNumber())
                    .withTag("institute.id", request.getInstituteId())
                    .send();
            throw new VacademyException("Failed to send WhatsApp OTP: " + e.getMessage());
        }
    }

    /**
     * Verify WhatsApp OTP
     */
    public Boolean verifyWhatsAppOtp(String phoneNumber, String otp) {
        try {
            log.info("Verifying WhatsApp OTP for phone: {}", phoneNumber);

            Optional<EmailOtp> otpOptional = otpRepository.findTopByPhoneNumberAndTypeOrderByCreatedAtDesc(phoneNumber,
                    NotificationConstants.OTP_TYPE_WHATSAPP);

            if (otpOptional.isEmpty()) {
                log.warn("No OTP found for phone: {}", phoneNumber);
                return false;
            }

            EmailOtp emailOtp = otpOptional.get();

            // Check expiration (10 minutes = 600000 ms)
            long now = System.currentTimeMillis();
            long createdAt = emailOtp.getCreatedAt().getTime();
            long differenceMs = now - createdAt;
            long differenceMinutes = differenceMs / (60 * 1000);

            log.info(
                    "WHATSAPP OTP VERIFICATION - Phone: {}, Now: {} ({}), CreatedAt: {} ({}), Difference: {}ms ({}min), JVM Timezone: {}",
                    phoneNumber,
                    now,
                    new java.util.Date(now),
                    createdAt,
                    emailOtp.getCreatedAt(),
                    differenceMs,
                    differenceMinutes,
                    java.util.TimeZone.getDefault().getID());

            if (differenceMs > 10 * 60 * 1000) {
                log.warn("WHATSAPP OTP EXPIRED - Phone: {}, Age: {}min, Threshold: 10min", phoneNumber,
                        differenceMinutes);
                throw new VacademyException("OTP has expired. Please request a new one.");
            }

            // Validate OTP
            if (emailOtp.getOtp().equals(otp)) {
                log.info("WHATSAPP OTP VERIFIED SUCCESSFULLY - Phone: {}", phoneNumber);
                emailOtp.setIsVerified("true");
                otpRepository.save(emailOtp);
                return true;
            }

            log.warn("WHATSAPP OTP MISMATCH - Phone: {}", phoneNumber);
            return false;

        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            log.error("Exception while verifying WhatsApp OTP: {}", e.getMessage(), e);
            throw new VacademyException("Failed to verify WhatsApp OTP: " + e.getMessage());
        }
    }

    /**
     * Generate random OTP
     */
    private String generateOTP(int length) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < length; i++) {
            otp.append(random.nextInt(10));
        }
        return otp.toString();
    }

    /**
     * Build Meta WhatsApp API payload from template configuration
     */
    private MetaWhatsAppPayload buildMetaPayload(String phoneNumber, String templateName, String languageCode,
            String otp, String settingJson) {
        try {
            // Parse setting_json to get parameter configuration
            JsonNode settingNode = objectMapper.readTree(settingJson);
            JsonNode parametersNode = settingNode.path("parameters");

            List<MetaWhatsAppPayload.Component> components = new ArrayList<>();

            // Build body component if configured
            if (parametersNode.has("body")) {
                JsonNode bodyParamsConfig = parametersNode.get("body");
                List<MetaWhatsAppPayload.Parameter> bodyParams = new ArrayList<>();

                if (bodyParamsConfig.isArray()) {
                    for (JsonNode paramConfig : bodyParamsConfig) {
                        if ("otp".equals(paramConfig.path("source").asText())) {
                            bodyParams.add(MetaWhatsAppPayload.Parameter.builder()
                                    .type(paramConfig.path("type").asText("text"))
                                    .text(otp)
                                    .build());
                        }
                    }
                }

                if (!bodyParams.isEmpty()) {
                    components.add(MetaWhatsAppPayload.Component.builder()
                            .type("body")
                            .parameters(bodyParams)
                            .build());
                }
            }

            // Build button component if configured
            if (parametersNode.has("button")) {
                JsonNode buttonParamsConfig = parametersNode.get("button");
                List<MetaWhatsAppPayload.Parameter> buttonParams = new ArrayList<>();

                if (buttonParamsConfig.isArray()) {
                    for (JsonNode paramConfig : buttonParamsConfig) {
                        if ("otp".equals(paramConfig.path("source").asText())) {
                            buttonParams.add(MetaWhatsAppPayload.Parameter.builder()
                                    .type(paramConfig.path("type").asText("text"))
                                    .text(otp)
                                    .build());
                        }
                    }
                }

                // Add button component after loop
                // Always use index "0" for URL buttons as required by Meta API
                if (!buttonParams.isEmpty()) {
                    components.add(MetaWhatsAppPayload.Component.builder()
                            .type("button")
                            .subType("url")
                            .index("0") // Meta API requires index 0 for URL buttons
                            .parameters(buttonParams)
                            .build());
                }
            }

            // Build template
            MetaWhatsAppPayload.Template template = MetaWhatsAppPayload.Template.builder()
                    .name(templateName)
                    .language(MetaWhatsAppPayload.Language.builder()
                            .code(languageCode)
                            .build())
                    .components(components)
                    .build();

            // Build final payload
            return MetaWhatsAppPayload.builder()
                    .messagingProduct("whatsapp")
                    .to(phoneNumber)
                    .type("template")
                    .template(template)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse settingJson, using default payload structure: {}", e.getMessage());
            // Fallback to default structure
            return buildDefaultMetaPayload(phoneNumber, templateName, languageCode, otp);
        }
    }

    /**
     * Build default Meta WhatsApp API payload (fallback)
     */
    private MetaWhatsAppPayload buildDefaultMetaPayload(String phoneNumber, String templateName, String languageCode,
            String otp) {
        // Build body parameters
        List<MetaWhatsAppPayload.Parameter> bodyParams = new ArrayList<>();
        bodyParams.add(MetaWhatsAppPayload.Parameter.builder()
                .type("text")
                .text(otp)
                .build());

        // Build button parameters
        List<MetaWhatsAppPayload.Parameter> buttonParams = new ArrayList<>();
        buttonParams.add(MetaWhatsAppPayload.Parameter.builder()
                .type("text")
                .text(otp)
                .build());

        // Build components
        List<MetaWhatsAppPayload.Component> components = new ArrayList<>();

        // Body component
        components.add(MetaWhatsAppPayload.Component.builder()
                .type("body")
                .parameters(bodyParams)
                .build());

        // Button component
        components.add(MetaWhatsAppPayload.Component.builder()
                .type("button")
                .subType("url")
                .index("0")
                .parameters(buttonParams)
                .build());

        // Build template
        MetaWhatsAppPayload.Template template = MetaWhatsAppPayload.Template.builder()
                .name(templateName)
                .language(MetaWhatsAppPayload.Language.builder()
                        .code(languageCode)
                        .build())
                .components(components)
                .build();

        // Build final payload
        return MetaWhatsAppPayload.builder()
                .messagingProduct("whatsapp")
                .to(phoneNumber)
                .type("template")
                .template(template)
                .build();
    }

    /**
     * Call Meta WhatsApp API
     */
    private boolean callMetaAPI(String phoneNumberId, String accessToken, MetaWhatsAppPayload payload) {
        try {
            String url = metaApiBaseUrl + "/" + phoneNumberId + "/messages";
            log.info("Calling Meta API: {}", url);
            log.info("Meta API Payload: {}", objectMapper.writeValueAsString(payload));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(accessToken);

            log.debug("Authorization header set with token: {}...",
                    accessToken.substring(0, Math.min(20, accessToken.length())));

            HttpEntity<MetaWhatsAppPayload> request = new HttpEntity<>(payload, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    request,
                    String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Meta API call successful. Response: {}", response.getBody());
                return true;
            } else {
                log.error("Meta API call failed. Status: {}, Response: {}", response.getStatusCode(),
                        response.getBody());
                return false;
            }

        } catch (Exception e) {
            log.error("Exception while calling Meta API: {}", e.getMessage(), e);
            log.error("Exception type: {}", e.getClass().getName());
            if (e.getCause() != null) {
                log.error("Cause: {}", e.getCause().getMessage());
            }
            SentryLogger.SentryEventBuilder.error(e)
                    .withMessage("Meta API call failed")
                    .withTag("notification.type", "WHATSAPP_OTP")
                    .send();
            return false;
        }
    }
}
