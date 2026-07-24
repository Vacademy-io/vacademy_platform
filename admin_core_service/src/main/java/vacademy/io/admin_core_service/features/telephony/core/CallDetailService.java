package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.telephony.core.dto.CallDetailDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads a single call's deep detail for the dashboard's "more details" view.
 *
 * <p>The paginated search projection deliberately stays lean; this service reads
 * the full row and, crucially, mines the stored raw provider webhook body
 * ({@code raw_payload_json}) for the fields that explain a failed/busy/no-answer
 * outcome — hangup cause, SIP/cause code, provider error string — which never
 * make it into the 48-char {@code termination_reason}. Everything provider-shaped
 * is best-effort: unparseable bodies just yield an empty {@code providerDetails}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CallDetailService {

    private final TelephonyCallLogRepository callLogRepository;
    private final ObjectMapper objectMapper;

    /**
     * Curated top-level webhook keys worth surfacing, mapped to a human label.
     * Matched case-insensitively against the parsed body; only present, non-blank
     * scalar values are included, in this order. Kept intentionally narrow — these
     * are diagnostic fields (never phone numbers), safe for any dashboard viewer.
     */
    private static final Map<String, String> INTERESTING_KEYS = buildInterestingKeys();

    private static Map<String, String> buildInterestingKeys() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("hangupcausename", "Hangup cause");
        m.put("hangupcause", "Hangup cause code");
        m.put("cause", "Cause");
        m.put("causecode", "Cause code");
        m.put("sipresponsecode", "SIP response");
        m.put("dialblegstatus", "Dial leg status");
        m.put("callstatus", "Provider status");
        m.put("endreason", "End reason");
        m.put("errormessage", "Error");
        m.put("error", "Error");
        m.put("reason", "Reason");
        m.put("disposition", "Provider disposition");
        m.put("billduration", "Billed duration");
        m.put("billsec", "Billed seconds");
        m.put("currency", "Currency");
        return m;
    }

    /**
     * @param unmask when true (caller holds VIEW_CALL_NUMBERS) the verbatim webhook
     *               body is included; otherwise only the curated diagnostic fields.
     */
    public CallDetailDTO detail(String callLogId, String instituteId, boolean unmask) {
        TelephonyCallLog row = callLogRepository.findById(callLogId)
                .orElseThrow(() -> new VacademyException("Call not found"));

        // Cross-tenant guard: the id is a UUID, but never let one institute read another's call.
        if (row.getInstituteId() == null || !row.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Call not found");
        }

        return CallDetailDTO.builder()
                .id(row.getId())
                .providerType(row.getProviderType())
                .direction(row.getDirection())
                .status(row.getStatus())
                .terminationReason(row.getTerminationReason())
                .providerCallId(row.getProviderCallId())
                .startTime(row.getStartTime())
                .answerTime(row.getAnswerTime())
                .endTime(row.getEndTime())
                .durationSeconds(row.getDurationSeconds())
                .price(row.getPrice())
                .providerDetails(parseProviderDetails(row.getRawPayloadJson()))
                .rawProviderResponse(unmask ? row.getRawPayloadJson() : null)
                .build();
    }

    /** Best-effort mine of the raw webhook body for the curated diagnostic keys. */
    private List<CallDetailDTO.KeyVal> parseProviderDetails(String rawPayloadJson) {
        List<CallDetailDTO.KeyVal> out = new ArrayList<>();
        if (rawPayloadJson == null || rawPayloadJson.isBlank()) return out;

        JsonNode root;
        try {
            root = objectMapper.readTree(rawPayloadJson);
        } catch (Exception e) {
            // Not JSON (e.g. form-encoded string) — nothing to structure; the raw
            // body (when unmasked) still carries the info.
            return out;
        }
        if (root == null || !root.isObject()) return out;

        // Index the body's keys lower-cased so we can match regardless of provider casing.
        Map<String, JsonNode> lowered = new LinkedHashMap<>();
        for (Iterator<String> it = root.fieldNames(); it.hasNext(); ) {
            String name = it.next();
            lowered.putIfAbsent(name.toLowerCase(), root.get(name));
        }
        for (Map.Entry<String, String> entry : INTERESTING_KEYS.entrySet()) {
            JsonNode node = lowered.get(entry.getKey());
            if (node == null || node.isNull() || node.isContainerNode()) continue;
            String value = node.asText("").trim();
            if (value.isEmpty()) continue;
            out.add(new CallDetailDTO.KeyVal(entry.getValue(), value));
        }
        return out;
    }
}
