package vacademy.io.admin_core_service.features.learner.service;

import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.HashMap;
import java.util.Map;

/**
 * The single source of truth for the workflow context published with
 * {@code SUB_ORG_MEMBER_ENROLLMENT}.
 *
 * <p>Every publisher of that event MUST build its context here. Two publishers exist —
 * {@code SubOrgLearnerService} (the /sub-org/v1/add-member route) and
 * {@code BulkAssignmentService} (the admin "Enroll Learner" wizard) — and they previously each
 * hand-rolled the map. That duplication is what let the contract drift unnoticed.
 *
 * <h3>Why {@code user} is published as well as {@code member}</h3>
 * Workflow nodes are authored against a context key, and the two enrollment events historically
 * disagreed on it: {@code LEARNER_BATCH_ENROLLMENT} publishes the person as {@code user}, this
 * event as {@code member}. A workflow subscribed to both — Vet Education's "VTC Enrollment
 * Welcome Email" is one — resolves its recipient from {@code #ctx['user']}, so when it ran off
 * this event it found nobody and failed with {@code MISSING_EMAIL_ADDRESS} while the execution
 * still reported COMPLETED (a send of zero recipients isn't an error to the engine, so the
 * failure is silent). Over 30 days that node logged 87 successes via the batch event and 6
 * failures — never a success — via this one.
 *
 * <p>Publishing the same {@link UserDTO} under BOTH keys makes a workflow work whichever key its
 * author reached for, and costs nothing: {@code member} keeps every existing sub-org workflow
 * working unchanged.
 *
 * <p><b>Do not remove either key.</b> Adding keys is safe; removing or renaming one silently
 * breaks whichever workflows referenced it, and — because a zero-recipient send still completes —
 * the breakage will not surface as a failed execution.
 */
public final class SubOrgMemberEnrollmentContext {

    private SubOrgMemberEnrollmentContext() {
    }

    /**
     * Convenience overload for callers where the person acting IS the sub-org's leader — the
     * /sub-org/v1/add-member route, where a practice admin adds their own staff.
     */
    public static Map<String, Object> build(UserDTO member, UserDTO subOrgAdmin,
                                            PackageSession packageSession) {
        return build(member, subOrgAdmin, subOrgAdmin, packageSession);
    }

    /**
     * @param member      the person being enrolled into the sub-org
     * @param subOrgAdmin the sub-org's OWN leader — NOT whoever clicked enroll. Workflow nodes
     *                    resolve the practice's LearnDash group from this person's email
     *                    ({@code get-leader-group?email=#ctx['subOrgAdmin']['email']}), so passing
     *                    the acting platform admin here either 404s or, worse, silently returns
     *                    THEIR group and files the member under the wrong practice. May be null
     *                    when the sub-org has no resolvable leader — deliberately left null rather
     *                    than falling back to the actor, because no group beats the wrong group.
     * @param enrolledBy  who performed the enrollment; for audit and notification nodes
     * @param packageSession the batch being enrolled into
     */
    public static Map<String, Object> build(UserDTO member, UserDTO subOrgAdmin, UserDTO enrolledBy,
                                            PackageSession packageSession) {
        Map<String, Object> contextData = new HashMap<>();
        contextData.put("member", member);
        // Alias — see class javadoc. Same object, so nodes written against either key resolve.
        contextData.put("user", member);
        contextData.put("subOrgAdmin", subOrgAdmin);
        contextData.put("enrolledBy", enrolledBy);
        contextData.put("packageSessionIds", packageSession != null ? packageSession.getId() : null);
        contextData.put("packageId",
                packageSession != null && packageSession.getPackageEntity() != null
                        ? packageSession.getPackageEntity().getId()
                        : null);
        return contextData;
    }
}
