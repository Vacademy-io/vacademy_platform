package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request for the payment-collection summary. Scoped to an institute; optionally
 * narrowed to a single sub-org and/or a UTC date window.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CollectionSummaryRequestDTO {
    private String instituteId;

    /** Optional. When set, only payments tied to this sub-org's enroll invites are summed. */
    private String subOrgId;

    /** Optional. Null = from epoch ("all time"). Filters payment_log.created_at. */
    private LocalDateTime startDateInUtc;

    /** Optional. Null = now. Filters payment_log.created_at. */
    private LocalDateTime endDateInUtc;

    /**
     * Optional IANA zone (e.g. "Asia/Kolkata") the per-day series should be bucketed in. The window
     * above is always a UTC instant range; only the day boundaries move. Omitted or unrecognised
     * falls back to UTC, which is what every caller got before this existed — so a payment taken at
     * 00:30 IST would be charted under the previous day.
     */
    private String timeZone;
}
