package vacademy.io.admin_core_service.features.telephony.core.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Body for {@code POST /telephony/calls/{id}/disposition} — the counsellor's
 * quick after-call outcome.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CallDispositionRequestDTO {

    /** Catalog key, e.g. INTERESTED / CALLBACK / RNR. Required. */
    private String dispositionKey;

    /** Optional free-text note. */
    private String notes;

    /** Promised call-back time (epoch millis) for a Callback disposition; optional. */
    private Long callbackAtEpochMillis;
}
