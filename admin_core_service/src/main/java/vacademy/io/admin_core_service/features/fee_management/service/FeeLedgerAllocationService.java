package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;

import java.math.BigDecimal;
import java.util.List;

@Service
@Slf4j
public class FeeLedgerAllocationService {

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private StudentFeeAllocationLedgerRepository studentFeeAllocationLedgerRepository;

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
}
