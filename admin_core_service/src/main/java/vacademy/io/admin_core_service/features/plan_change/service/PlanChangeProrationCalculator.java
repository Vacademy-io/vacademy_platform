package vacademy.io.admin_core_service.features.plan_change.service;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.util.PlanValidityResolver;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Calendar;
import java.util.Date;

/**
 * Works out what an upgrade costs today and when the new access window ends.
 *
 * <p>The model is the PLAN-PRICE DIFFERENCE, not time proration: the learner pays
 * {@code targetPrice - currentPrice} and the access window restarts at the new plan's
 * full validity from today. Days already elapsed on the current cycle are not deducted
 * and days unused are not refunded -- the learner trades one plan's price for another's
 * and gets a complete new term. No refunds are ever produced: the credit is capped at
 * the target price, so the charge floors at zero.
 *
 * <p>A trial gets no credit at all: it has paid nothing for the current cycle (only the
 * token-registration auth, which is not the plan price), so it pays the target in full.
 *
 * <p>Pure and stateless so the arithmetic is unit-testable without a database.
 */
@Component
public class PlanChangeProrationCalculator {

    private static final long MILLIS_PER_DAY = 24L * 60 * 60 * 1000;

    /** The priced outcome of moving one UserPlan onto one target plan. */
    public record Proration(
            /** Price of the plan being left behind, allowed against the target. Never > target price. */
            BigDecimal credit,
            /** {@code max(0, targetPrice - credit)} — what to charge right now. */
            BigDecimal amountDueNow,
            /** Days still paid for on the current plan. */
            long remainingDays,
            /** New access-until date for an IMMEDIATE change. Null when the target is lifetime. */
            Date newEndDate) {
    }

    public Proration compute(UserPlan userPlan, PaymentPlan targetPlan) {
        return compute(userPlan, targetPlan, new Date());
    }

    /** {@code now} is a parameter so tests can pin the clock. */
    public Proration compute(UserPlan userPlan, PaymentPlan targetPlan, Date now) {
        BigDecimal targetPrice = money(targetPlan != null ? targetPlan.getActualPrice() : 0d);
        BigDecimal currentPrice = money(userPlan != null && userPlan.getPaymentPlan() != null
                ? userPlan.getPaymentPlan().getActualPrice()
                : 0d);

        long remainingDays = remainingDays(userPlan, now);
        BigDecimal credit = credit(userPlan, currentPrice, targetPrice);
        BigDecimal amountDueNow = targetPrice.subtract(credit).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new Proration(credit, amountDueNow, remainingDays, newEndDate(targetPlan, now));
    }

    /**
     * Days still paid for. Zero once the plan has lapsed — an expired learner has no unused
     * value to credit and pays the new plan in full, which is also what makes "upgrade" the
     * natural reactivation path for a dunning-expired membership.
     */
    public long remainingDays(UserPlan userPlan, Date now) {
        if (userPlan == null || userPlan.getEndDate() == null) {
            return 0L;
        }
        long millis = userPlan.getEndDate().getTime() - now.getTime();
        if (millis <= 0) {
            return 0L;
        }
        // Ceiling: a learner with 12 hours left has one day of value, not zero.
        return (millis + MILLIS_PER_DAY - 1) / MILLIS_PER_DAY;
    }

    /**
     * The current plan's FULL price, allowed against the target -- so the learner pays the
     * difference between the two plans. Not scaled by days elapsed or remaining: an upgrade
     * on day 2 and an upgrade on day 25 of the same cycle cost the same, and the new term
     * starts fresh either way.
     *
     * <p>Capped at the target price so an upgrade never produces a negative charge, and
     * zero for a trial, which has paid nothing to trade in.
     */
    private BigDecimal credit(UserPlan userPlan, BigDecimal currentPrice, BigDecimal targetPrice) {
        if (currentPrice.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (userPlan != null && Boolean.TRUE.equals(userPlan.getIsTrial())) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return currentPrice.min(targetPrice).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * An immediate change restarts the window: {@code today + target validity}. Null when
     * the target has no validity — that is a lifetime plan, and stamping an end date on it
     * would expire access the enrollment path deliberately left open.
     */
    public Date newEndDate(PaymentPlan targetPlan, Date now) {
        Integer validity = PlanValidityResolver.fromPlan(targetPlan);
        if (validity == null) {
            return null;
        }
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(now);
        calendar.add(Calendar.DAY_OF_MONTH, validity);
        return calendar.getTime();
    }

    private static BigDecimal money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static Integer firstNonNull(Integer a, Integer b) {
        return a != null ? a : b;
    }
}
