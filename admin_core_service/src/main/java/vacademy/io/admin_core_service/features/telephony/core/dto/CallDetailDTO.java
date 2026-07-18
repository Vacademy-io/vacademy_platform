package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;

/**
 * Deep per-call detail for the Call Log "more details" popover — richer than the
 * search row, built to explain <em>why</em> a call ended the way it did (FAILED /
 * BUSY / NO_ANSWER especially). Adds the provider's own hangup/cause/error fields
 * (best-effort parsed out of the stored raw webhook body) plus price + full timing
 * that the paginated list omits.
 *
 * <p>{@code providerDetails} is a curated, human-labeled subset safe to show to
 * any dashboard viewer. {@code rawProviderResponse} is the verbatim webhook body
 * and may contain phone numbers, so it is populated only for callers holding the
 * {@code VIEW_CALL_NUMBERS} authority (same gate as the masked numbers).
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallDetailDTO {

    private String id;
    private String providerType;
    private String direction;
    private String status;
    private String terminationReason;
    private String providerCallId;

    private Timestamp startTime;
    private Timestamp answerTime;
    private Timestamp endTime;
    private Integer durationSeconds;
    private BigDecimal price;

    /** Curated provider fields (hangup cause, SIP/cause code, error, …) parsed from the raw body. */
    private List<KeyVal> providerDetails;

    /** Verbatim provider webhook body — null unless the caller may unmask numbers. */
    private String rawProviderResponse;

    @Data
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class KeyVal {
        private String label;
        private String value;
    }
}
