package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusRepository;
import vacademy.io.admin_core_service.features.audience.service.LeadStatusService;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * SET_LEAD_STATUS workflow node — maps a disposition branch onto one of the institute's
 * EXISTING lead statuses (e.g. the builder picks status_key "CALL_BACK" or "NOT_INTERESTED"
 * from {@code lead_status}). This replaces the earlier broken approach that stamped
 * hardcoded AI_* keys which no institute actually has in its catalog.
 *
 * <p>Config carries a single {@code statusKey} — the {@code lead_status.status_key} the builder
 * selected. At runtime we resolve it against the lead's institute
 * ({@link LeadStatusRepository#findByInstituteIdAndStatusKey}); on a hit we route the change
 * through {@link LeadStatusService#changeLeadStatus} (the single status-change entry point, so
 * history + LEAD_STATUS_CHANGED stay consistent) with source {@code "AI_WORKFLOW"}. A missing
 * status is a builder/config mismatch: we warn and no-op rather than fail the run.</p>
 *
 * <p>This node never pauses — it returns a plain change-map so the engine continues traversal.</p>
 */
@Component
@RequiredArgsConstructor
public class SetLeadStatusNodeHandler implements NodeHandler {

    private static final Logger log = LoggerFactory.getLogger(SetLeadStatusNodeHandler.class);

    private final LeadStatusRepository leadStatusRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Field-injected with {@code @Lazy} to break the same init-time bean cycle CallAiNodeHandler
     * guards against: SET_LEAD_STATUS → LeadStatusService → WorkflowTriggerService →
     * WorkflowEngineService → NodeHandlerRegistry → SET_LEAD_STATUS. It's only used at runtime
     * inside {@link #handle}, so a lazily-resolved proxy is correct.
     */
    @Autowired
    @Lazy
    private LeadStatusService leadStatusService;

    @Override
    public boolean supports(String nodeType) {
        return "SET_LEAD_STATUS".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                      String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates,
                                      int countProcessed) {
        Map<String, Object> out = new HashMap<>();

        String statusKey = readConfig(nodeConfigJson, "statusKey");
        String instituteId = str(context.get("instituteId"));
        // The lead id (audience_response.id). "eventId" is the AUDIENCE id, not the lead,
        // so it is deliberately NOT a fallback — mirror CallAiNodeHandler.
        String responseId = firstNonBlank(str(context.get("responseId")), str(context.get("leadId")));

        if (isBlank(statusKey)) {
            log.warn("SET_LEAD_STATUS node: no statusKey configured — skipping (institute {}, lead {})",
                    instituteId, responseId);
            out.put("leadStatusSkipped", "no_status_key");
            return out;
        }
        if (isBlank(instituteId) || isBlank(responseId)) {
            log.warn("SET_LEAD_STATUS node: missing instituteId ({}) or responseId ({}) in context — skipping statusKey {}",
                    instituteId, responseId, statusKey);
            out.put("leadStatusSkipped", "missing_context");
            return out;
        }

        Optional<LeadStatus> status = leadStatusRepository.findByInstituteIdAndStatusKey(instituteId, statusKey);
        if (status.isEmpty()) {
            log.warn("SET_LEAD_STATUS node: no lead_status with key '{}' for institute {} — no-op for lead {}",
                    statusKey, instituteId, responseId);
            out.put("leadStatusSkipped", "status_not_found");
            out.put("statusKey", statusKey);
            return out;
        }

        try {
            leadStatusService.changeLeadStatus(responseId, status.get().getId(), null, "AI_WORKFLOW");
            log.info("SET_LEAD_STATUS node: lead {} -> status '{}' ({}) for institute {}",
                    responseId, statusKey, status.get().getId(), instituteId);
            out.put("leadStatusChanged", true);
            out.put("statusKey", statusKey);
            out.put("statusId", status.get().getId());
        } catch (Exception ex) {
            log.warn("SET_LEAD_STATUS node: failed to set status '{}' for lead {}: {}",
                    statusKey, responseId, ex.getMessage());
            out.put("leadStatusSkipped", "change_failed");
            out.put("statusKey", statusKey);
        }
        return out;
    }

    private String readConfig(String json, String key) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode v = objectMapper.readTree(json).get(key);
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

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
