package vacademy.io.admin_core_service.features.fee_management.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

/**
 * Computes how much a CPO-enrolled learner owes RIGHT NOW. Used by:
 * <ul>
 *   <li>{@code ComplexPaymentOptionOperation} at enrollment time, to override the
 *       gateway amount so the learner is charged only what is currently due (not
 *       the full contract sum).</li>
 *   <li>The new {@code POST /learner/v1/fee/pay-installments} endpoint to validate
 *       the requested SFP rows and total their outstanding amount.</li>
 * </ul>
 *
 * "Currently due" = sum of {@code amount_expected - amount_paid} for unpaid
 * StudentFeePayment rows whose {@code due_date <= today + grace_days}. Rows
 * without a {@code due_date} are treated as due-now (back-compat with the
 * non-installment school flow that creates a single SFP row with no date).
 */
@Service
public class CpoDuesCalculator {

    /** Grace period applied when filtering by due_date. Future tunable. */
    private static final int DEFAULT_GRACE_DAYS = 0;

    private static final List<String> UNPAID_STATUSES = List.of("PENDING", "PARTIAL_PAID", "OVERDUE");

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    /**
     * Sums outstanding amounts for the given UserPlan that are due as of {@code today + grace_days}.
     * Rows without a due_date are included.
     */
    public BigDecimal computeDuesForUserPlan(String userPlanId) {
        return computeDuesForUserPlan(userPlanId, DEFAULT_GRACE_DAYS);
    }

    public BigDecimal computeDuesForUserPlan(String userPlanId, int graceDays) {
        if (userPlanId == null) return BigDecimal.ZERO;

        Date cutoff = Date.valueOf(LocalDate.now().plusDays(graceDays));
        List<StudentFeePayment> unpaid = studentFeePaymentRepository
                .findByUserPlanIdAndStatusNotOrderByDueDateAsc(userPlanId, "PAID");

        BigDecimal total = BigDecimal.ZERO;
        for (StudentFeePayment sfp : unpaid) {
            if (!UNPAID_STATUSES.contains(sfp.getStatus())) continue;
            if (sfp.getDueDate() != null && sfp.getDueDate().after(cutoff)) continue;
            total = total.add(outstandingAmount(sfp));
        }
        return total;
    }

    /**
     * Total contract value for a UserPlan: sum of every unpaid SFP row regardless of
     * due_date. Useful when a UserPlan has no installment dates and the strategy
     * needs to fall back to charging the full sum (matches legacy school behavior).
     */
    public BigDecimal computeFullOutstandingForUserPlan(String userPlanId) {
        if (userPlanId == null) return BigDecimal.ZERO;
        BigDecimal total = BigDecimal.ZERO;
        List<StudentFeePayment> unpaid = studentFeePaymentRepository
                .findByUserPlanIdAndStatusNotOrderByDueDateAsc(userPlanId, "PAID");
        for (StudentFeePayment sfp : unpaid) {
            if (!UNPAID_STATUSES.contains(sfp.getStatus())) continue;
            total = total.add(outstandingAmount(sfp));
        }
        return total;
    }

    /**
     * Sums outstanding amount for an explicit list of SFP ids (used by the
     * {@code pay-installments} endpoint where the learner picks rows to pay).
     */
    public BigDecimal computeOutstandingForSfpIds(List<String> sfpIds) {
        if (sfpIds == null || sfpIds.isEmpty()) return BigDecimal.ZERO;
        List<StudentFeePayment> rows = studentFeePaymentRepository.findAllById(sfpIds);
        BigDecimal total = BigDecimal.ZERO;
        for (StudentFeePayment sfp : rows) {
            if (!UNPAID_STATUSES.contains(sfp.getStatus())) continue;
            total = total.add(outstandingAmount(sfp));
        }
        return total;
    }

    private BigDecimal outstandingAmount(StudentFeePayment sfp) {
        BigDecimal expected = sfp.getAmountExpected() != null ? sfp.getAmountExpected() : BigDecimal.ZERO;
        BigDecimal paid = sfp.getAmountPaid() != null ? sfp.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal outstanding = expected.subtract(paid);
        return outstanding.signum() > 0 ? outstanding : BigDecimal.ZERO;
    }
}
