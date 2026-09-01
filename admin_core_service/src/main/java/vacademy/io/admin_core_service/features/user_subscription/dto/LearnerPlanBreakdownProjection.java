package vacademy.io.admin_core_service.features.user_subscription.dto;

/**
 * One enrolment of one learner, priced. Backs the Due side view, which has to show every plan a
 * learner holds — including the ones that are NOT counted as due — so an admin can see for
 * themselves why a cancelled enrolment contributes nothing.
 */
public interface LearnerPlanBreakdownProjection {
    String getUserPlanId();

    String getCourseName();

    String getPlanStatus();

    String getPaymentType();

    Double getBilled();

    Double getPaid();

    /** True when the status is one the institute still bills — ACTIVE / PENDING_FOR_PAYMENT. */
    Boolean getCountsTowardsDue();

    String getCurrency();
}
