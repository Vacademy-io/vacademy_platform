package vacademy.io.admin_core_service.features.learner_offline.service;

import java.util.List;

/**
 * Pure resolution logic for whether offline download is allowed at a given
 * content node, per the offline plan (Part A1). Deliberately static/stateless
 * so it can be unit-tested without a Spring context — see
 * OfflineAccessResolverTest for the edge cases this must satisfy.
 *
 * <p>Inputs are the explicit {@code allow} values found on any node of the
 * ancestor chain [PACKAGE, PACKAGE_SESSION, SUBJECT, MODULE, CHAPTER, SLIDE]
 * (order does not matter to this algorithm — {@code null} = no rule at that
 * level = inherit), the course's own default ({@code package.course_setting
 * .offlineDefaultEnabled}), and the institute-wide feature flag
 * ({@code OFFLINE_ACCESS_SETTING.enabled}).
 *
 * <p>Algorithm:
 * <ol>
 *   <li>Institute offline disabled -> false, unconditionally.</li>
 *   <li>Any explicit {@code allow=false} anywhere on the chain -> false
 *       (the strictest explicit ancestor wins; covers "slide true under
 *       chapter false").</li>
 *   <li>Else any explicit {@code allow=true} anywhere on the chain -> true
 *       (covers "course default false + chapter true").</li>
 *   <li>Else fall back to the course default.</li>
 * </ol>
 */
public final class OfflineAccessResolver {

    private OfflineAccessResolver() {
    }

    public static boolean resolve(List<Boolean> chainRuleAllows, boolean courseDefaultEnabled,
            boolean instituteOfflineEnabled) {
        if (!instituteOfflineEnabled) {
            return false;
        }
        if (chainRuleAllows != null) {
            for (Boolean allow : chainRuleAllows) {
                if (allow != null && !allow) {
                    return false;
                }
            }
            for (Boolean allow : chainRuleAllows) {
                if (allow != null && allow) {
                    return true;
                }
            }
        }
        return courseDefaultEnabled;
    }
}
