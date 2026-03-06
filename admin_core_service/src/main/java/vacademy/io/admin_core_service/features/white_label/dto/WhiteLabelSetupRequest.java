package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Request payload for the white-label setup wizard.
 * Supports two domain modes:
 * - VACADEMY_SUBDOMAIN → auto-derives *.vacademy.io URLs from the given slug
 * - CUSTOM → caller supplies explicit domain names per portal
 */
@Data
public class WhiteLabelSetupRequest {

    /**
     * "VACADEMY_SUBDOMAIN" or "CUSTOM"
     */
    @JsonProperty("domain_type")
    private String domainType;

    // ── VACADEMY_SUBDOMAIN mode ───────────────────────────────────────────────

    /**
     * Slug used to derive free vacademy sub-domains.
     * e.g. "myschool" → learner: myschool.vacademy.io, admin:
     * myschool-admin.vacademy.io
     */
    @JsonProperty("subdomain_slug")
    private String subdomainSlug;

    // ── CUSTOM domain mode ────────────────────────────────────────────────────

    /** Full custom domain for learner portal, e.g. "learn.myschool.com" */
    @JsonProperty("custom_learner_domain")
    private String customLearnerDomain;

    /** Full custom domain for admin portal, e.g. "admin.myschool.com" */
    @JsonProperty("custom_admin_domain")
    private String customAdminDomain;

    /**
     * Full custom domain for teacher portal (optional), e.g. "teach.myschool.com"
     */
    @JsonProperty("custom_teacher_domain")
    private String customTeacherDomain;

    // ── Per-role routing config (optional — uses sensible defaults) ──────────

    @JsonProperty("learner_routing")
    private PortalRoutingConfig learnerRouting;

    @JsonProperty("admin_routing")
    private PortalRoutingConfig adminRouting;

    @JsonProperty("teacher_routing")
    private PortalRoutingConfig teacherRouting;
}
