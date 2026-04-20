package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Filter body for the institute-wide adjustment history endpoint.
 * Posted as request body so multi-valued filters (event types, adjustment types)
 * are easy to express and the URL stays clean.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteAdjustmentHistoryFilterDTO {

    private Integer page;         // 0-indexed; defaults to 0
    private Integer size;         // defaults to 20, max 100

    private List<String> eventTypes;       // SUBMITTED, APPROVED, REJECTED, RETRACTED
    private List<String> adjustmentTypes;  // CONCESSION, PENALTY
    private List<String> resultingStatuses; // optional: PENDING_FOR_APPROVAL, APPROVED, REJECTED, RETRACTED

    private String actorUserId;   // filter by specific FD/admin who took the action
    private LocalDate startDate;  // filter created_at >= startDate
    private LocalDate endDate;    // filter created_at <= endDate

    private String studentSearch; // partial name/phone/username — matched against student roster
}
