package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.extern.slf4j.Slf4j;
import vacademy.io.common.logging.SentryLogger;

import java.util.HashMap;
import java.util.Map;

/**
 * Reports the failures mentorship deliberately swallows.
 *
 * <p>Several mentorship paths are best-effort on purpose: a notification must never
 * roll back the assignment that triggered it, and a scheduler tick must not die on
 * one bad row. The cost of that design is silence — a learner is never told they
 * have a mentor, a reminder never goes out, and nothing surfaces anywhere. These
 * calls keep the swallow (behaviour is unchanged) while making the failure visible.
 *
 * <p>Warning level, not error: the system is still correct, one side effect was
 * lost. Every event carries {@code feature=mentorship} plus the stage, so they
 * group in Sentry instead of scattering.
 */
@Slf4j
public final class MentorshipErrorReporter {

    private MentorshipErrorReporter() {}

    private static final String FEATURE = "mentorship";

    /**
     * @param stage       what was being attempted, e.g. "notify-assignment"
     * @param instituteId tenant, so one institute's misconfiguration is obvious
     * @param context     extra key/values worth having on the event (ids, not PII)
     */
    public static void report(Throwable e, String stage, String instituteId, Map<String, String> context) {
        try {
            Map<String, String> tags = new HashMap<>();
            tags.put("feature", FEATURE);
            tags.put("mentorship.stage", stage);
            if (instituteId != null && !instituteId.isBlank()) tags.put("institute_id", instituteId);
            if (context != null) {
                context.forEach((k, v) -> {
                    if (v != null && !v.isBlank()) tags.put(k, v);
                });
            }
            SentryLogger.logWarning(e, "mentorship " + stage + " failed", tags);
        } catch (Exception reportingFailure) {
            // Reporting must never be the thing that breaks a best-effort path.
            log.warn("mentorship error reporting failed for stage {}: {}", stage, reportingFailure.getMessage());
        }
    }

    public static void report(Throwable e, String stage, String instituteId) {
        report(e, stage, instituteId, Map.of());
    }
}
