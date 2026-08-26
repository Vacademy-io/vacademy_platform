package vacademy.io.admin_core_service.features.user_subscription.dto;

/**
 * Raw aggregate behind the billing summary: what live enrolments were billed, what has been
 * collected against them, and how many plans each figure covers.
 */
public interface BillingSummaryProjection {

    Double getTotalBilled();

    Double getCollected();

    /** Unpaid remainder across live enrolments (plan price minus what was paid). */
    Double getDue();

    Long getPlanCount();

    Long getSettledPlanCount();

    String getCurrency();
}
