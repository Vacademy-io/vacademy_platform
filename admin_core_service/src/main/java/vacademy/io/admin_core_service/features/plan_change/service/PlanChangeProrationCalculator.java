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
 * <p>The model is straight time-proration: the learner has already paid for days they have
 * not used, so that unused value is credited against the new plan's full price and the
 * access window restarts at the new plan's validity. No refunds are ever produced — the
 * credit is capped at the current plan's price, and the charge floors at zero.
 *
 * <p>Pure and stateless so the arithmetic is unit-testable without a database.
 */
@Component
public class PlanChangeProrationCalculator {

    private static final long MILLIS_PER_DAY = 24L * 60 * 60 * 1000;

    /** The priced outcome of moving one UserPlan onto one target plan. */
    public record Proration(
            /** Unused value of the plan being left behind. Never negative, never > current price. */
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
        BigDecimal credit = credit(userPlan, currentPrice, remainingDays);
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
     * {@code currentPrice * remainingDays / currentValidity}, capped at the current price.
     *
     * <p>Validity comes from the live plan first and the plan_json snapshot second — a plan
     * retired by a later Payment Settings edit still has to price correctly. A plan with no
     * resolvable validity (lifetime, or a malformed row) yields no credit rather than a
     * fabricated one: we cannot say what fraction of "forever" is unused.
     */
    private BigDecimal credit(UserPlan userPlan, BigDecimal currentPrice, long remainingDays) {
        if (remainingDays <= 0 || currentPrice.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        Integer validity = userPlan != null
                ? firstNonNull(PlanValidityResolver.fromPlan(userPlan.getPaymentPlan()),
                        PlanValidityResolver.fromPlanJson(userPlan.getPlanJson()))
                : null;
        if (validity == null || validity <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal raw = currentPrice
                .multiply(BigDecimal.valueOf(Math.min(remainingDays, validity)))
                .divide(BigDecimal.valueOf(validity), 2, RoundingMode.HALF_UP);
        return raw.min(currentPrice).setScale(2, RoundingMode.HALF_UP);
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
