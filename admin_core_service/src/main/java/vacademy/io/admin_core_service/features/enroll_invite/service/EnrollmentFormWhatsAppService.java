package vacademy.io.admin_core_service.features.enroll_invite.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.notification.util.PhoneCountryUtil;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Sends the "thank you for registering" WhatsApp message right after a learner
 * submits an enrollment form.
 *
 * The template is resolved per-institute from
 * {@code setting.FORM_FILL_WHATSAPP_SETTING.data}:
 *
 * <pre>
 * "FORM_FILL_WHATSAPP_SETTING": {
 *   "data": {
 *     "enabled": true,
 *     "template_name": "suchbliss_testing_confirmation",
 *     "language_code": "en"
 *   }
 * }
 * </pre>
 *
 * An institute without that block simply gets no message — the feature is opt-in
 * per institute, and a template approved for one WABA is meaningless for another.
 */
@Slf4j
@Service
public class EnrollmentFormWhatsAppService {

    private static final String SETTING_KEY = "FORM_FILL_WHATSAPP_SETTING";
    private static final String DEFAULT_LANGUAGE = "en";

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private NotificationService notificationService;

    /**
     * Fire-and-forget: a WhatsApp failure must never fail the enrollment the
     * learner just completed, so everything here is caught and logged.
     */
    @Async
    public void sendFormFillThankYou(UserDTO user, String instituteId) {
        try {
            if (user == null || !StringUtils.hasText(instituteId)) {
                return;
            }

            Optional<Institute> instituteOpt = instituteRepository.findById(instituteId);
            if (instituteOpt.isEmpty()) {
                return;
            }
            Institute institute = instituteOpt.get();

            JsonNode config = readConfig(institute);
            if (config == null || !config.path("enabled").asBoolean(true)) {
                log.debug("Form-fill WhatsApp not enabled for institute {}", instituteId);
                return;
            }

            String templateName = config.path("template_name").asText(null);
            if (!StringUtils.hasText(templateName)) {
                log.warn("FORM_FILL_WHATSAPP_SETTING for institute {} has no template_name", instituteId);
                return;
            }
            String languageCode = config.path("language_code").asText(DEFAULT_LANGUAGE);

            String phone = PhoneCountryUtil.normalizePhone(
                    user.getMobileNumber(),
                    PhoneCountryUtil.defaultsToIndia(institute.getCountry()));
            if (!StringUtils.hasText(phone)) {
                log.info("Skipping form-fill WhatsApp for user {} — no mobile number", user.getId());
                return;
            }

            String name = StringUtils.hasText(user.getFullName()) ? user.getFullName() : "there";

            WhatsappRequest request = new WhatsappRequest();
            request.setTemplateName(templateName);
            request.setLanguageCode(languageCode);
            // {{1}} = learner name, {{2}} = the upcoming Monday (trial start), e.g. "17th July".
            // Sending both is harmless for single-variable templates — the provider only
            // substitutes the placeholders the template actually declares.
            request.setUserDetails(List.of(Map.of(phone, Map.of(
                    "1", name,
                    "2", nextMondayLabel()))));

            notificationService.sendWhatsappViaUnified(request, instituteId);
            log.info("Sent form-fill WhatsApp (template={}) to user {}", templateName, user.getId());
        } catch (Exception e) {
            log.error("Failed to send form-fill WhatsApp for user {} in institute {}: {}",
                    user != null ? user.getId() : null, instituteId, e.getMessage(), e);
        }
    }

    /**
     * The next Monday on/after today, formatted like "17th July" for the trial-start
     * line in the welcome template. If today is Monday, the trial starts today.
     */
    private String nextMondayLabel() {
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        java.time.LocalDate monday = today.with(
                java.time.temporal.TemporalAdjusters.nextOrSame(java.time.DayOfWeek.MONDAY));
        int day = monday.getDayOfMonth();
        String month = monday.getMonth().getDisplayName(
                java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH);
        return day + ordinalSuffix(day) + " " + month;
    }

    private String ordinalSuffix(int day) {
        if (day >= 11 && day <= 13) {
            return "th";
        }
        switch (day % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    }

    private JsonNode readConfig(Institute institute) {
        String settingJson = institute.getSetting();
        if (!StringUtils.hasText(settingJson)) {
            return null;
        }
        try {
            JsonNode data = objectMapper.readTree(settingJson)
                    .path("setting").path(SETTING_KEY).path("data");
            return data.isMissingNode() || data.isNull() ? null : data;
        } catch (Exception e) {
            log.warn("Could not parse {} for institute {}: {}", SETTING_KEY, institute.getId(), e.getMessage());
            return null;
        }
    }
}
