package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Result of placing an Aavtaar AI call. {@code callLogId} is our correlation id
 * (telephony_call_log.id) — the same id Aavtaar echoes back in metadata on the
 * end-of-call webhook.
 */
@Data
@Builder
public class AiCallResponseDTO {
    private String callLogId;
    private String status;
    private boolean dispatched;
    private String providerMessage;
}
