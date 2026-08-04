package vacademy.io.admin_core_service.features.institute_learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;

import java.util.Map;

/**
 * Single answer to "may this institute mail auth-service's built-in credential email
 * when a learner is enrolled?".
 * <p>
 * Institutes that ship their own enrollment email (an EMAIL template fired by a
 * LEARNER_BATCH_ENROLLMENT workflow) turn the built-in one off; otherwise the learner
 * receives two welcome mails carrying the same password. Two settings can say no —
 * {@code COURSE_SETTING.enrollmentNotifications.showSendCredentials} (the "Send
 * Credentials" switch on the display-settings page) and
 * {@code LEARNER_ENROLLMENT_SETTING.sendCredentials} — and either one wins, matching
 * how {@code LearnerEnrollRequestService.getSendCredentialsFlag} layers them.
 * <p>
 * Every read defaults to {@code true}: an institute that never touched the toggles, a
 * missing settings blob, or a read failure must not silently swallow a credential
 * delivery. Only an explicit {@code false} suppresses the mail.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentCredentialPolicyService {

    private final InstituteSettingService instituteSettingService;

    /**
     * @param instituteId institute the learner is being enrolled into
     * @return whether auth-service should send its built-in credential email
     */
    public boolean shouldSendCredentialEmail(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return true;
        }
        if (!readCourseSettingEnrollmentFlag(instituteId, "showSendCredentials")) {
            log.info("Suppressing built-in credential email for institute {}: " +
                    "COURSE_SETTING.enrollmentNotifications.showSendCredentials=false", instituteId);
            return false;
        }
        if (!readLearnerEnrollmentFlag(instituteId, "sendCredentials")) {
            log.info("Suppressing built-in credential email for institute {}: " +
                    "LEARNER_ENROLLMENT_SETTING.sendCredentials=false", instituteId);
            return false;
        }
        return true;
    }

    /** Reads INSTITUTE.setting.COURSE_SETTING.data.enrollmentNotifications.{flagKey}. */
    @SuppressWarnings("unchecked")
    private boolean readCourseSettingEnrollmentFlag(String instituteId, String flagKey) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, "COURSE_SETTING");
            if (!(data instanceof Map)) {
                return true;
            }
            Object enrollmentNotifications = ((Map<String, Object>) data).get("enrollmentNotifications");
            if (!(enrollmentNotifications instanceof Map)) {
                return true;
            }
            Object flag = ((Map<String, Object>) enrollmentNotifications).get(flagKey);
            return !(flag instanceof Boolean) || (Boolean) flag;
        } catch (Exception e) {
            log.warn("Could not read COURSE_SETTING.enrollmentNotifications.{} for institute {}: {}",
                    flagKey, instituteId, e.getMessage());
            return true;
        }
    }

    /** Reads INSTITUTE.setting.LEARNER_ENROLLMENT_SETTING.data.{flagKey}. */
    @SuppressWarnings("unchecked")
    private boolean readLearnerEnrollmentFlag(String instituteId, String flagKey) {
        try {
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(
                    instituteId, "LEARNER_ENROLLMENT_SETTING");
            if (!(data instanceof Map)) {
                return true;
            }
            Object flag = ((Map<String, Object>) data).get(flagKey);
            return !(flag instanceof Boolean) || (Boolean) flag;
        } catch (Exception e) {
            log.warn("Could not read LEARNER_ENROLLMENT_SETTING.{} for institute {}: {}",
                    flagKey, instituteId, e.getMessage());
            return true;
        }
    }
}
