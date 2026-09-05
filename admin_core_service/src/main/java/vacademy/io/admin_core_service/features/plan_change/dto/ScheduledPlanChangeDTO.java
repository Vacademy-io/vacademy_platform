package vacademy.io.admin_core_service.features.plan_change.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

/**
 * A downgrade the learner has already booked but which has not landed yet. Surfaced on the
 * membership card so "you're on Monthly" doesn't quietly become false at the next renewal.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ScheduledPlanChangeDTO {
    private String changeRequestId;
    private String toPlanId;
    private String toPlanName;
    private Double toPlanPrice;
    private String currency;
    /** The end of the paid cycle — when the new plan starts billing. */
    private Date effectiveFrom;
}
