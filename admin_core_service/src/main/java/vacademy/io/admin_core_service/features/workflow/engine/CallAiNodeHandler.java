package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.telephony.core.AiCallService;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallRequestDTO;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallResponseDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * CALL_AI workflow node — places one Aavtaar AI call for the lead in context.
 *
 * Reads {@code instituteId}, the lead's user id, phone and (optional) campaignId
 * from the execution context (falling back to the institute's default campaign).
 * Places the call via {@link AiCallService} and writes {@code aiCallLogId} /
 * {@code aiCallStatus} back into context. It does NOT pause — the outcome arrives
 * later on the end-of-call webhook and is handled by AiCallOutcomeProcessor, so a
 * counsellor is assigned based on the result independently of this node.
 */
@Component
@RequiredArgsConstructor
public class CallAiNodeHandler implements NodeHandler {

    private static final Logger log = LoggerFactory.getLogger(CallAiNodeHandler.class);

    private final AiCallService aiCallService;
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public boolean supports(String nodeType) {
        return "CALL_AI".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        Map<String, Object> out = new HashMap<>();

        String instituteId = str(context.get("instituteId"));
        String userId = firstNonBlank(str(context.get("leadUserId")), str(context.get("userId")));
        String phone = firstNonBlank(str(context.get("phone")), str(context.get("parentMobile")));
        // The lead id (audience_response.id) — present in the AUDIENCE_LEAD_SUBMISSION
        // context as "responseId". NOTE: "eventId" there is the AUDIENCE id, not the
        // lead, so it is deliberately NOT used as a fallback.
        String responseId = firstNonBlank(str(context.get("responseId")), str(context.get("leadId")));
        // Campaign id: the node's config wins (the recipe's optional override), then
        // context, else AiCallService falls back to the institute's AI_CALLING_SETTING.
        String campaignId = firstNonBlank(readConfig(nodeConfigJson, "campaignId"), str(context.get("campaignId")));
        // AiCallService resolves phone/userId from the responseId when they're blank.

        AiCallRequestDTO req = new AiCallRequestDTO();
        req.setInstituteId(instituteId);
        req.setUserId(userId);
        req.setPhoneNumber(phone);
        req.setResponseId(responseId);
        req.setCampaignId(campaignId);

        try {
            AiCallResponseDTO resp = aiCallService.placeCall(req, null);
            out.put("aiCallPlaced", resp.isDispatched());
            out.put("aiCallLogId", resp.getCallLogId());
            out.put("aiCallStatus", resp.getStatus());
        } catch (Exception e) {
            log.error("CALL_AI node: failed to place AI call for lead {}", userId, e);
            out.put("aiCallPlaced", false);
            out.put("aiCallError", e.getMessage());
        }
        return out;
    }

    /** Read a single string value from the node's config JSON (null-safe). */
    private String readConfig(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = mapper.readTree(json).get(key);
            return v == null || v.isNull() ? null : v.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private String firstNonBlank(String... vals) {
        for (String v : vals) {
            if (v != null && !v.isBlank() && !"null".equals(v)) return v;
        }
        return null;
    }
}
