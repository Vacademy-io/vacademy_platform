package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
@Slf4j
public class FeeLedgerAllocationService {

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private StudentFeeAllocationLedgerRepository studentFeeAllocationLedgerRepository;

    @Autowired
    private PaymentLogRepository paymentLogRepository;

    @Transactional
    public void allocatePayment(String paymentLogId, BigDecimal totalPaymentAmount, String userPlanId) {
        log.info("Starting ledger allocation for PaymentLog: {}, Amount: {}, UserPlan: {}", paymentLogId,
                totalPaymentAmount, userPlanId);

        // Fetch unpaid bills ordered by due date ascending (FIFO)
        List<StudentFeePayment> unpaidBills = studentFeePaymentRepository
                .findByUserPlanIdAndStatusNotOrderByDueDateAsc(userPlanId, "PAID");

        BigDecimal remainingAmount = totalPaymentAmount;

        for (StudentFeePayment bill : unpaidBills) {
            if (remainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
                break; // No more money to allocate
            }

            BigDecimal amountToPayOnThisBill = bill.getAmountExpected().subtract(bill.getAmountPaid());
            BigDecimal allocatedAmount;

            if (remainingAmount.compareTo(amountToPayOnThisBill) >= 0) {
                // We can fully pay this bill
                allocatedAmount = amountToPayOnThisBill;
                bill.setAmountPaid(bill.getAmountExpected());
                bill.setStatus("PAID");
            } else {
                // We can partially pay this bill
                allocatedAmount = remainingAmount;
                bill.setAmountPaid(bill.getAmountPaid().add(allocatedAmount));
                bill.setStatus("PARTIAL_PAID");
            }

            remainingAmount = remainingAmount.subtract(allocatedAmount);
            studentFeePaymentRepository.save(bill);

            // Record this allocation in the Ledger
            StudentFeeAllocationLedger ledger = new StudentFeeAllocationLedger();
            ledger.setUserId(bill.getUserId());
            ledger.setPaymentLogId(paymentLogId);
            ledger.setStudentFeePaymentId(bill.getId());
            ledger.setAmountAllocated(allocatedAmount);
            ledger.setAllocationType("PAYMENT");
            ledger.setRemarks("Auto-allocated via FIFO");
            studentFeeAllocationLedgerRepository.save(ledger);

            log.info("Allocated {} to Bill {}, New Status: {}", allocatedAmount, bill.getId(), bill.getStatus());
        }

        if (remainingAmount.compareTo(BigDecimal.ZERO) > 0) {
            log.warn("Payment Log {} had excess amount {} after paying all bills for UserPlan {}", paymentLogId,
                    remainingAmount, userPlanId);
            // Optionally: create a dummy ledger entry for "OVERPAYMENT" or hold it in user
            // wallet.
        }
    }

    /**
     * Offline/admin flow using the existing controller endpoint:
     *  - Fetches an existing PaymentLog by ID (template/source record)
     *  - Creates a NEW PaymentLog row representing this concrete payment with status PAID
     *  - Allocates that new payment across unpaid installments
     *  - Writes separate ledger rows per student_fee_payment_id pointing to the NEW PaymentLog
     *
     * The original {@link #allocatePayment(String, BigDecimal, String)} method is left
     * unchanged; this method no longer calls it.
     */
    @Transactional
    public void  allocatePaymentForLog(String paymentLogId) {
        PaymentLog sourceLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new IllegalArgumentException("PaymentLog not found for id: " + paymentLogId));

        if (sourceLog.getUserPlan() == null) {
            throw new IllegalStateException("PaymentLog has no associated user plan for id: " + paymentLogId);
        }

        Double rawAmount = sourceLog.getPaymentAmount();
        if (rawAmount == null || rawAmount <= 0) {
            throw new IllegalStateException("Payment amount must be positive for PaymentLog id: " + paymentLogId);
        }

        BigDecimal totalPaymentAmount = BigDecimal.valueOf(rawAmount);

        // Create a fresh PaymentLog row representing this concrete payment event
        PaymentLog actualPaymentLog = new PaymentLog();
        actualPaymentLog.setStatus("ACTIVE");
        actualPaymentLog.setPaymentStatus("PAID");
        actualPaymentLog.setUserId(sourceLog.getUserId());
        actualPaymentLog.setVendor(sourceLog.getVendor());
        actualPaymentLog.setVendorId(sourceLog.getVendorId());
        actualPaymentLog.setDate(new Date());
        actualPaymentLog.setCurrency(sourceLog.getCurrency());
        actualPaymentLog.setUserPlan(sourceLog.getUserPlan());
        actualPaymentLog.setPaymentAmount(rawAmount);
        actualPaymentLog.setPaymentSpecificData(sourceLog.getPaymentSpecificData());

        actualPaymentLog = paymentLogRepository.save(actualPaymentLog);

        // Allocate this new payment across unpaid installments; all ledger rows will
        // reference ONLY the new PaymentLog's ID.
        allocatePaymentForNewLog(actualPaymentLog.getId(), totalPaymentAmount, sourceLog.getUserPlan().getId());
    }

    /**
     * Internal helper for the new flow. Duplicates the allocation logic so that
     * the existing allocatePayment(...) method remains untouched.
     */
    @Transactional
    public void allocatePaymentForNewLog(String paymentLogId, BigDecimal totalPaymentAmount, String userPlanId) {
        log.info("[NEW FLOW] Starting ledger allocation for PaymentLog: {}, Amount: {}, UserPlan: {}", paymentLogId,
                totalPaymentAmount, userPlanId);

        List<StudentFeePayment> unpaidBills = studentFeePaymentRepository
                .findByUserPlanIdAndStatusNotOrderByDueDateAsc(userPlanId, "PAID");

        BigDecimal remainingAmount = totalPaymentAmount;

        for (StudentFeePayment bill : unpaidBills) {
            if (remainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal amountToPayOnThisBill = bill.getAmountExpected().subtract(bill.getAmountPaid());
            BigDecimal allocatedAmount;

            if (remainingAmount.compareTo(amountToPayOnThisBill) >= 0) {
                allocatedAmount = amountToPayOnThisBill;
                bill.setAmountPaid(bill.getAmountExpected());
                bill.setStatus("PAID");
            } else {
                allocatedAmount = remainingAmount;
                bill.setAmountPaid(bill.getAmountPaid().add(allocatedAmount));
                bill.setStatus("PARTIAL_PAID");
            }

            remainingAmount = remainingAmount.subtract(allocatedAmount);
            studentFeePaymentRepository.save(bill);

            StudentFeeAllocationLedger ledger = new StudentFeeAllocationLedger();
            ledger.setUserId(bill.getUserId());
            ledger.setPaymentLogId(paymentLogId);
            ledger.setStudentFeePaymentId(bill.getId());
            ledger.setAmountAllocated(allocatedAmount);
            ledger.setAllocationType("PAYMENT");
            ledger.setRemarks("[NEW FLOW] Auto-allocated via FIFO");
            studentFeeAllocationLedgerRepository.save(ledger);

            log.info("[NEW FLOW] Allocated {} to Bill {}, New Status: {}", allocatedAmount, bill.getId(),
                    bill.getStatus());
        }

        if (remainingAmount.compareTo(BigDecimal.ZERO) > 0) {
            log.warn("[NEW FLOW] Payment Log {} had excess amount {} after paying all bills for UserPlan {}",
                    paymentLogId, remainingAmount, userPlanId);
        }
    }

    /**
     * New entry point for the user-based offline/admin API:
     *  - Takes userId + explicit amount
     *  - Creates a NEW PaymentLog with status PAID
     *  - Allocates that payment across all unpaid installments for the user
     */
    @Transactional
    public void allocatePaymentForUser(String userId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be positive");
        }
        // Fetch all unpaid/partial bills for this user, ordered by due date
        List<StudentFeePayment> unpaidBills = studentFeePaymentRepository
                .findByUserIdAndStatusNotOrderByDueDateAsc(userId, "PAID");

        if (unpaidBills.isEmpty()) {
            // Nothing to allocate; simply return
            return;
        }

        // Create a new PaymentLog representing this offline/admin payment.
        // We intentionally do not attach a UserPlan here to keep the flow
        // independent of the subscription layer.
        PaymentLog paymentLog = new PaymentLog();
        paymentLog.setStatus("ACTIVE");
        paymentLog.setPaymentStatus("PAID");
        paymentLog.setUserId(userId);
        paymentLog.setVendor("OFFLINE"); // or "CASH" based on your convention
        paymentLog.setVendorId(null);
        paymentLog.setDate(new Date());
        paymentLog.setCurrency("INR"); // adjust if you support multi-currency
        paymentLog.setUserPlan(null);
        paymentLog.setPaymentAmount(amount.doubleValue());
        paymentLog.setPaymentSpecificData(null);

        paymentLog = paymentLogRepository.save(paymentLog);

        // Allocate this payment across unpaid installments; all ledger rows will
        // reference ONLY this new PaymentLog's ID.
        BigDecimal remainingAmount = amount;

        for (StudentFeePayment bill : unpaidBills) {
            if (remainingAmount.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }

            BigDecimal amountToPayOnThisBill = bill.getAmountExpected().subtract(bill.getAmountPaid());
            BigDecimal allocatedAmount;

            if (remainingAmount.compareTo(amountToPayOnThisBill) >= 0) {
                allocatedAmount = amountToPayOnThisBill;
                bill.setAmountPaid(bill.getAmountExpected());
                bill.setStatus("PAID");
            } else {
                allocatedAmount = remainingAmount;
                bill.setAmountPaid(bill.getAmountPaid().add(allocatedAmount));
                bill.setStatus("PARTIAL_PAID");
            }

            remainingAmount = remainingAmount.subtract(allocatedAmount);
            studentFeePaymentRepository.save(bill);

            StudentFeeAllocationLedger ledger = new StudentFeeAllocationLedger();
            ledger.setUserId(bill.getUserId());
            ledger.setPaymentLogId(paymentLog.getId());
            ledger.setStudentFeePaymentId(bill.getId());
            ledger.setAmountAllocated(allocatedAmount);
            ledger.setAllocationType("PAYMENT");
            ledger.setRemarks("[USER OFFLINE] Auto-allocated via FIFO");
            studentFeeAllocationLedgerRepository.save(ledger);

            log.info("[USER OFFLINE] Allocated {} to Bill {}, New Status: {}", allocatedAmount, bill.getId(),
                    bill.getStatus());
        }

        if (remainingAmount.compareTo(BigDecimal.ZERO) > 0) {
            log.warn("[USER OFFLINE] Payment Log {} had excess amount {} after paying all bills for user {}",
                    paymentLog.getId(), remainingAmount, userId);
        }
    }
}
