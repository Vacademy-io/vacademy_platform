package vacademy.io.common.payment.enums;

public enum PaymentType {
    INITIAL,
    RENEWAL,
    SCHOOL,
    APPLICATION_FEE,
    AI_CREDIT_PACK,
    /**
     * Prorated difference charged when a learner upgrades to a costlier plan. Rides the
     * same order/webhook plumbing as RENEWAL but the confirmation additionally swaps
     * user_plan.plan_id (and, for a cross-option move, the payment option + enroll
     * invite) from the pending user_plan_change_request.
     */
    PLAN_CHANGE,

}
