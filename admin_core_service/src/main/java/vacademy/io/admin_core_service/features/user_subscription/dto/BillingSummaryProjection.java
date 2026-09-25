package vacademy.io.admin_core_service.features.user_subscription.dto;

/**
 * Raw aggregate behind the billing summary: what came in, what learners with access still owe,
 * and what falls due next. See {@code UserPlanRepository.DUE_OBLIGATION_CTES} for the rule.
 */
public interface BillingSummaryProjection {
    Double getCollected();
    /** Overdue obligations on live enrolments and unpaid invoices. */
    Double getDue();
    /** Obligations falling due within the upcoming horizon. */
    Double getUpcoming();
    Long getLearnersOwing();
    Long getLearnersUpcoming();
    Long getPlanCount();
    /** Live, priced one-time plans with no payment recorded — activated by hand. */
    Long getActivatedWithoutPaymentCount();
    /** Every unpaid installment / invoice on live enrolments, whatever its due date. */
    Double getOutstanding();
    Long getLearnersOutstanding();
    String getCurrency();
}
