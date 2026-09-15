package vacademy.io.admin_core_service.features.user_subscription.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Collected / Due / Upcoming for an institute, as an admin means them: what came in, what learners
 * who have access still owe right now, and what falls due next.
 *
 * <p>{@code due} is only ever money on granted access — an overdue instalment, a lapsed
 * subscription renewal, an unpaid invoice. An unfinished checkout is not due (nobody has access),
 * and a one-time purchase is never due (it is paid or it is not enrolled). {@code totalBilled} is
 * always {@code collected + due}, so the cards can never disagree with each other.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class BillingSummaryResponseDTO {
    /** collected + due. */
    private Double totalBilled;
    /** Sum of PAID payment logs in the window. */
    private Double collected;
    /** Overdue: obligations on live enrolments whose due date has passed, plus unpaid invoices. */
    private Double due;
    /** Obligations that fall due within {@link #upcomingDays}. Expected, not yet owed. */
    private Double upcoming;
    /** The horizon {@link #upcoming} was computed over. */
    private Integer upcomingDays;
    /** Distinct learners with something overdue — the rows on the Due list. */
    private Long learnersOwing;
    /** Distinct learners with something falling due within the horizon. */
    private Long learnersUpcoming;
    /** Live enrolments in the window. */
    private Long planCount;
    /**
     * Live, priced one-time plans with no payment recorded against them — activated by an admin.
     * Might be an offline payment nobody recorded or a free grant, so it is reported, not billed.
     */
    private Long activatedWithoutPaymentCount;
    /** Most common currency across the live enrolments. null when none is resolvable. */
    private String currency;
}
