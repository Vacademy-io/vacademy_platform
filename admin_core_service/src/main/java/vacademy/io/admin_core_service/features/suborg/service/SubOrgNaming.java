package vacademy.io.admin_core_service.features.suborg.service;

import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteTerminologyService.Terms;

/**
 * Single source of truth for every human-readable name the sub-org flows mint
 * (invite names, payment option names, payment plan names).
 *
 * <p>These used to be hardcoded English literals ("Sub-Org Subscription: …",
 * "SubOrgLearner — …"), which ignored the institute's Naming Settings — an institute that
 * renamed "Sub-Org" to "Branch" and "Learner" to "Student" still saw "SubOrgLearner" on
 * every auto-created invite. Each builder now takes the institute's resolved {@link Terms}.
 *
 * <p>Centralised deliberately: the re-sync backfill regenerates existing names by calling
 * these same builders, so it can only stay in step with creation if both go through here.
 * Changing a format string here changes it in both places at once.
 */
public final class SubOrgNaming {

    private SubOrgNaming() {
    }

    private static String orUnknown(String value) {
        return StringUtils.hasText(value) ? value : "unknown";
    }

    /** Org-level invite the sub-org admin pays through. */
    public static String orgInviteName(Terms terms, String subOrgName) {
        return terms.subOrg() + " Subscription: " + orUnknown(subOrgName);
    }

    /** Scoped FREE invite minted per package session after the sub-org admin pays. */
    public static String scopedInviteName(Terms terms, String packageName) {
        return terms.subOrg() + " Access: " + orUnknown(packageName);
    }

    /** Mirror invite that sub-org learners enroll through. */
    public static String learnerInviteName(Terms terms, String psLabel, String optionLabel) {
        return terms.subOrg() + " " + terms.learner()
                + " — " + orUnknown(psLabel) + " · " + orUnknown(optionLabel);
    }

    public static String adminPaymentOptionName(Terms terms, String subOrgName) {
        return terms.subOrg() + " Plan: " + orUnknown(subOrgName);
    }

    public static String adminPaymentPlanName(Terms terms) {
        return terms.subOrg() + " Plan";
    }

    public static String freePaymentOptionName(Terms terms) {
        return "Free Access (" + terms.subOrg() + ")";
    }

    public static String freePaymentPlanName(Terms terms) {
        return terms.subOrg() + " Free Plan";
    }

    public static String registrationPaymentOptionName(Terms terms, String templateName) {
        return terms.subOrg() + " Registration: " + orUnknown(templateName);
    }

    public static String registrationPaymentPlanName(Terms terms) {
        return terms.subOrg() + " Registration Plan";
    }
}
