package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Click-to-call request body. instituteId is required because
 * CustomUserDetails doesn't carry it — the frontend has it in local context
 * and passes it explicitly.
 */
@Data
@NoArgsConstructor
public class ConnectCallRequestDTO {
    private String instituteId;
    private String responseId;     // audience_response.id
    private String userId;         // optional, for log/debug

    /**
     * Optional: the counsellor picked a specific provider number from the
     * runtime picker. When set + the id is enabled, the orchestrator uses it
     * directly and skips strategy selection. When null/blank, the configured
     * selector strategy decides (sticky-per-lead by default).
     */
    private String preferredNumberId;
}
