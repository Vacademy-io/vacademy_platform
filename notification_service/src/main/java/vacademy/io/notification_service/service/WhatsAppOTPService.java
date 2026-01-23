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

    @Autowired
    private WhatsAppProviderFactory whatsAppProviderFactory;

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

            // Fetch Institute Settings
            InstituteInfoDTO institute = instituteInternalService.getInstituteByInstituteId(request.getInstituteId());
            String jsonString = institute.getSetting();
            JsonNode root = objectMapper.readTree(jsonString);

            // Determine Provider via Factory
            // We need to inject the factory. For now, manual instantiation or Autowired?
            // Since we are inside a Service, we should Autowired the Factory.

            // To avoid huge refactor of this file adding fields, I will use the factory
            // bean if injected,
            // or just instantiate helpers here if they were valid beans.
            // But Factory needs dependencies.
            // Let's assume we add @Autowired WhatsAppProviderFactory to this class.

            WhatsAppServiceProvider provider = whatsAppProviderFactory.getProvider(root);

            // We pass the ROOT settings to the provider, so it can traverse to find its
            // specific config.
            // (As per the decision in Factory step to keep interface flexible)

            // Wait, we designed the Interface to verify logic.
            // WatiWhatsAppServiceProvider expects "awati" node or root?
            // In WatiWhatsAppServiceProvider I wrote: if (credentials.has("wati")) ...
            // That implies it expects the parent of "wati", which is UTILITY_WHATSAPP.

            // MetaWhatsAppServiceProvider expects "meta" node or root.

            // So we need to pass the *Corret Configuration Node*.
            // The Factory logic checked "setting -> WHATSAPP_SETTING -> data ->
            // UTILITY_WHATSAPP".
            // Let's reuse that logic here to pass the *specific* node?
            // Or change the providers to handle root?

            // Correct approach: Pass the SPECIFIC node that contains the credentials.
            // Factory logic:
            JsonNode utilityWhatsapp = root.path("WHATSAPP_SETTING")
                    .path("data")
                    .path("UTILITY_WHATSAPP");

            JsonNode utilityMetaWhatsapp = root.path("WHATSAPP_SETTING")
                    .path("data")
                    .path("UTILITY_META_WHATSAPP");

            JsonNode credentialsNode = root; // Default validity

            if (provider instanceof WatiWhatsAppServiceProvider) {
                credentialsNode = utilityWhatsapp;
            } else if (provider instanceof MetaWhatsAppServiceProvider) {
                // Meta provider logic is complex with fallbacks.
                // If we found UTILITY_META_WHATSAPP and chose Meta, pass that.
                if (!utilityMetaWhatsapp.isMissingNode()
                        && "META".equalsIgnoreCase(utilityMetaWhatsapp.path("provider").asText(""))) {
                    credentialsNode = utilityMetaWhatsapp;
                } else if (!utilityWhatsapp.isMissingNode()) {
                    // Legacy Meta might be in UTILITY_WHATSAPP
                    credentialsNode = utilityWhatsapp;
                }
                // If both missing, we pass root so Meta logic can try its recursive/fallback
                // paths
            }

            return provider.sendOtp(request, otp, credentialsNode);

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
}
