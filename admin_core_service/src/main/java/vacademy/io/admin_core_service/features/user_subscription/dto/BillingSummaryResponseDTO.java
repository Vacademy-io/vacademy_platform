package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Total / Collected / Due for an institute, as an admin means them: what the courses cost, what
 * came in, and the difference. {@code due} is always {@code totalBilled - collected}, so the three
 * cards on Manage Payments and the Payment Dashboard can never disagree with each other.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BillingSummaryResponseDTO {

    /** Sum of the plan amount of every live enrolment in the window. */
    private Double totalBilled;

    /** Sum of PAID payment logs raised against those enrolments. */
    private Double collected;

    /** totalBilled - collected, floored at 0. */
    private Double due;

    /** Live enrolments the figures cover. */
    private Long planCount;

    /** Enrolments that are fully paid up. */
    private Long settledPlanCount;

    /** Most common currency across those enrolments; null when none is resolvable. */
    private String currency;
}
