package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_account.repository.UserAccountLedgerRepository;
import vacademy.io.admin_core_service.features.user_account.service.UserAccountLedgerService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * When a learner's course is removed (the plan is TERMINATED), the installments still owed on it
 * stop being owed. They used to stay PENDING, so the payment history kept listing them as due
 * and the Fee Plan block kept the whole balance outstanding (I2CAN, 2026-10-21).
 *
 * <p>Each open bill becomes {@link #CANCELLED} with {@code amount_expected} cut to what was
 * actually paid on it, so money already received stays on record and nothing is left to collect.
 * The ledger gets the matching entry: each bill's ledger total is brought to its new amount
 * (normally a reversal of what was cancelled, under {@link #LEDGER_SOURCE_TYPE}), which also
 * keeps a bill whose ledger rows are missing from going negative. Paid, waived and
 * already-cancelled bills are left alone. A soft cancel (access until the plan ends) does not
 * call this: the learner still owes for the time they keep.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FeeBillCancellationService {

    public static final String CANCELLED = "CANCELLED";
    public static final String LEDGER_SOURCE_TYPE = "PLAN_CANCELLED";
    private static final Set<String> SETTLED = Set.of("PAID", "WAIVED", CANCELLED, "DELETED");

    private final StudentFeePaymentRepository studentFeePaymentRepository;
    private final UserAccountLedgerService userAccountLedgerService;
    private final UserAccountLedgerRepository userAccountLedgerRepository;

    /** @return how many bills were cancelled */
    @Transactional
    public int cancelOpenBills(String userPlanId, String reason) {
        List<StudentFeePayment> bills = studentFeePaymentRepository.findByUserPlanId(userPlanId);
        String remark = reason != null ? reason : "Course removed: installment cancelled";
        int cancelled = 0;
        for (StudentFeePayment bill : bills) {
            String status = bill.getStatus() == null ? "" : bill.getStatus().toUpperCase();
            if (SETTLED.contains(status)) continue;

            BigDecimal paid = scale(bill.getAmountPaid());
            bill.setAmountExpected(paid);
            bill.setStatus(CANCELLED);
            studentFeePaymentRepository.save(bill);
            cancelled++;

            if (bill.getInstituteId() == null || bill.getInstituteId().isBlank()) continue;
            BigDecimal onLedger = scale(userAccountLedgerRepository.debitNetBySourceId(bill.getId()));
            BigDecimal delta = paid.subtract(onLedger);
            // java.sql.Date refuses toInstant(); re-wrap the millis (as CpoDiscountService does).
            LocalDate due = bill.getDueDate() != null
                    ? new java.sql.Date(bill.getDueDate().getTime()).toLocalDate() : null;
            if (delta.signum() < 0) {
                userAccountLedgerService.recordDebitReversal(bill.getUserId(), bill.getInstituteId(),
                        delta.negate(), "INR", due, LEDGER_SOURCE_TYPE, bill.getId(), null, remark);
            } else if (delta.signum() > 0) {
                userAccountLedgerService.recordDebitAccrual(bill.getUserId(), bill.getInstituteId(),
                        delta, "INR", due, LEDGER_SOURCE_TYPE, bill.getId(), null, remark);
            }
        }
        if (cancelled > 0) {
            log.info("Cancelled {} open fee bill(s) of user plan {}", cancelled, userPlanId);
        }
        return cancelled;
    }

    private static BigDecimal scale(BigDecimal v) {
        return (v == null ? BigDecimal.ZERO : v).setScale(2, RoundingMode.HALF_UP);
    }
}
