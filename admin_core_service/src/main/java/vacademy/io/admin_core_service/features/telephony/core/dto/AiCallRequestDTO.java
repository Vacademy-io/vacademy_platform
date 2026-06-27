package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Data;

import java.util.Map;

/**
 * Request to place a single Aavtaar AI call against a lead.
 *
 * Used both by the manual click-to-AI-call endpoint and (server-side) by the
 * workflow CALL_AI node. {@code userId} + {@code instituteId} + {@code phoneNumber}
 * are required (telephony_call_log.user_id is NOT NULL). {@code campaignId} selects
 * the AI script/persona; if blank the caller is expected to have resolved it from
 * the institute's AI_CALLING_SETTING.
 */
@Data
public class AiCallRequestDTO {
    private String instituteId;
    /** AI-voice provider type; defaults to AAVTAAR when blank. */
    private String provider;
    /**
     * What this call targets: LEAD (default), PACKAGE_SESSION_STUDENT,
     * LIVE_SESSION_PARTICIPANT. Blank ⇒ LEAD (preserves the original lead flow).
     */
    private String subjectType;
    /**
     * Domain id of the subject (LEAD = audience_response.id; student = the package
     * session membership id; etc.). Blank ⇒ falls back to {@link #responseId} for leads.
     */
    private String subjectId;
    private String userId;
    private String phoneNumber;
    private String responseId;
    /**
     * Provider-agnostic agent the author picks (e.g. "Class Feedback"); resolved to the
     * active provider's raw campaign id via the AI_CALLING_SETTING campaigns registry.
     * Preferred over {@link #campaignId}.
     */
    private String campaignName;
    /** Raw provider campaign id — explicit override / back-compat. Wins over {@link #campaignName}. */
    private String campaignId;
    private String customerName;
    private String customerEmail;
    /** Extra key/values merged into the metadata echoed back on the webhook. */
    private Map<String, Object> metadata;
}
