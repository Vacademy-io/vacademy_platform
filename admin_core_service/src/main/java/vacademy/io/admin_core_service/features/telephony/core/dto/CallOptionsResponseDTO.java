package vacademy.io.admin_core_service.features.telephony.core.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Response for {@code GET /v1/telephony/calls/options}. Tells the runtime
 * picker (1) every ExoPhone the counsellor could pick from and (2) which
 * one would be auto-selected today by the institute's configured strategy.
 *
 * The frontend pre-selects {@code recommendedNumberId} as the default radio
 * choice in the picker popover. The counsellor can override before clicking
 * Call. If they don't override (or there's only one number), the picker is
 * skipped entirely and the recommended id is sent straight to /connect.
 */
@Data
@Builder
public class CallOptionsResponseDTO {

    @Data
    @Builder
    public static class NumberChoice {
        private String id;
        private String phoneNumber;
        private String label;
        private String region;
        private Integer priority;
    }

    private List<NumberChoice> numbers;
    private String recommendedNumberId;
    private String strategyKey;
}
