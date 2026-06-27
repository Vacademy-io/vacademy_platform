package vacademy.io.admin_core_service.features.telephony.spi.dto;

import lombok.Builder;
import lombok.Value;

import java.util.Map;

/**
 * Provider-neutral request to place one AI call. The adapter maps this onto its
 * provider's API (campaign id, metadata bag, etc.).
 */
@Value
@Builder
public class AiCallSpec {
    String instituteId;
    /** The user being called (generic — a lead, a student, a participant). */
    String userId;
    String responseId;
    String phoneNumber;
    String campaignId;
    String customerName;
    String customerEmail;
    /** Our correlation id (= telephony_call_log.id) — must be echoed back on the report. */
    String correlationId;
    /** Subject kind (LEAD default) — lets the outcome pipeline pick subject-specific actions. */
    String subjectType;
    /** Subject domain id; also carried in {@link #metadata} so it round-trips on the report. */
    String subjectId;
    Map<String, Object> metadata;
}
