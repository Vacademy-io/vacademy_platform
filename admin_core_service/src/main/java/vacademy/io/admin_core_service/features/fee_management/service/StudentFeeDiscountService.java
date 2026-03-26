package vacademy.io.admin_core_service.features.fee_management.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;

@Service
public class StudentFeeDiscountService {

    private static final Logger log = LoggerFactory.getLogger(StudentFeeDiscountService.class);

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Transactional
    public StudentFeePayment applyManualDiscount(
            String studentFeePaymentId,
            String userId,
            BigDecimal discountAmountDelta,
            String discountReason
    ) {
        if (!StringUtils.hasText(studentFeePaymentId)) {
            throw new VacademyException("studentFeePaymentId is required");
        }
        if (!StringUtils.hasText(userId)) {
            throw new VacademyException("userId is required");
        }
        if (discountAmountDelta == null) {
            throw new VacademyException("discountAmount is required");
        }
        if (discountAmountDelta.compareTo(BigDecimal.ZERO) <= 0) {
            throw new VacademyException("discountAmount must be > 0");
        }

        StudentFeePayment bill = studentFeePaymentRepository.findById(studentFeePaymentId)
                .orElseThrow(() -> new VacademyException("student_fee_payment not found: " + studentFeePaymentId));

        // Enforce user-specific discount
        if (!userId.equals(bill.getUserId())) {
            throw new VacademyException("student_fee_payment " + studentFeePaymentId + " does not belong to user " + userId);
        }

        BigDecimal amountExpected = bill.getAmountExpected() != null ? bill.getAmountExpected() : BigDecimal.ZERO;
        BigDecimal amountPaid = bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal currentDiscount = bill.getDiscountAmount() != null ? bill.getDiscountAmount() : BigDecimal.ZERO;

        // Total discount cannot exceed amount_expected (your requirement).
        BigDecimal nextDiscountTotal = currentDiscount.add(discountAmountDelta);
        if (nextDiscountTotal.compareTo(amountExpected) > 0) {
            throw new VacademyException("Discount exceeds amount_expected for this installment. "
                    + "amount_expected=" + amountExpected + ", current_discount=" + currentDiscount
                    + ", requested_delta=" + discountAmountDelta + ", next_total=" + nextDiscountTotal);
        }

        bill.setDiscountAmount(nextDiscountTotal);

        // Optional reason update
        if (StringUtils.hasText(discountReason)) {
            bill.setDiscountReason(discountReason);
        }

        StudentFeePayment saved = studentFeePaymentRepository.save(bill);
        log.info("Applied manual discount: billId={}, userId={}, delta={}, newDiscountTotal={}, status={}",
                studentFeePaymentId, userId, discountAmountDelta, nextDiscountTotal, saved.getStatus());
        return saved;
    }
}

