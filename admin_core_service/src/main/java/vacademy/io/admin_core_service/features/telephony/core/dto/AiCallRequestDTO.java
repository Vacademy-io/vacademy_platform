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
    private String userId;
    private String phoneNumber;
    private String responseId;
    private String campaignId;
    private String customerName;
    private String customerEmail;
    /** Extra key/values merged into the metadata echoed back on the webhook. */
    private Map<String, Object> metadata;
}
