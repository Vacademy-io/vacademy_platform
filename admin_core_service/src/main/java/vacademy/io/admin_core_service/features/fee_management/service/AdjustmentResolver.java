package vacademy.io.admin_core_service.features.fee_management.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentEventType;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAdjustmentHistoryRepository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Central resolver for a bill's current effective adjustment.
 * Replaces the removed adjustment_* columns on student_fee_payment with a
 * lookup into student_fee_adjustment_history via current_adjustment_history_id.
 *
 * A RETRACTED event counts as "no active adjustment" for compute purposes,
 * so downstream services see the same effective state they did before the
 * schema refactor.
 */
@Service
public class AdjustmentResolver {

    @Autowired
    private StudentFeeAdjustmentHistoryRepository adjustmentHistoryRepository;

    public StudentFeeAdjustmentHistory getCurrentEvent(StudentFeePayment bill) {
        if (bill == null || !StringUtils.hasText(bill.getCurrentAdjustmentHistoryId())) {
            return null;
        }
        return adjustmentHistoryRepository.findById(bill.getCurrentAdjustmentHistoryId())
                .orElse(null);
    }

    public Map<String, StudentFeeAdjustmentHistory> loadCurrentEventsForBills(
            Collection<StudentFeePayment> bills) {
        if (bills == null || bills.isEmpty()) return Collections.emptyMap();
        List<String> ids = bills.stream()
                .map(StudentFeePayment::getCurrentAdjustmentHistoryId)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) return Collections.emptyMap();
        return adjustmentHistoryRepository.findByIdIn(ids).stream()
                .collect(Collectors.toMap(StudentFeeAdjustmentHistory::getId, Function.identity()));
    }

    public StudentFeeAdjustmentHistory lookup(
            StudentFeePayment bill,
            Map<String, StudentFeeAdjustmentHistory> eventMap) {
        if (bill == null || !StringUtils.hasText(bill.getCurrentAdjustmentHistoryId())) {
            return null;
        }
        return eventMap.get(bill.getCurrentAdjustmentHistoryId());
    }

    /** Returns null if the current event is a RETRACTED one (no active adjustment). */
    public StudentFeeAdjustmentHistory effectiveOrNull(StudentFeeAdjustmentHistory event) {
        if (event == null) return null;
        if (AdjustmentEventType.RETRACTED.name().equals(event.getEventType())) return null;
        return event;
    }

    // ───── Compute helpers (accept the current event, possibly null) ─────

    public BigDecimal computeAdjustmentEffect(StudentFeeAdjustmentHistory event) {
        StudentFeeAdjustmentHistory effective = effectiveOrNull(event);
        if (effective == null) return BigDecimal.ZERO;
        if (!"APPROVED".equals(effective.getResultingStatus())) return BigDecimal.ZERO;
        BigDecimal amt = effective.getAmount() != null ? effective.getAmount() : BigDecimal.ZERO;
        if ("PENALTY".equals(effective.getAdjustmentType())) return amt;
        if ("CONCESSION".equals(effective.getAdjustmentType())) return amt.negate();
        return BigDecimal.ZERO;
    }

    public BigDecimal computeConcession(StudentFeeAdjustmentHistory event) {
        StudentFeeAdjustmentHistory effective = effectiveOrNull(event);
        if (effective == null) return BigDecimal.ZERO;
        if (!"APPROVED".equals(effective.getResultingStatus())) return BigDecimal.ZERO;
        if (!"CONCESSION".equals(effective.getAdjustmentType())) return BigDecimal.ZERO;
        return effective.getAmount() != null ? effective.getAmount() : BigDecimal.ZERO;
    }

    public BigDecimal computePenalty(StudentFeeAdjustmentHistory event) {
        StudentFeeAdjustmentHistory effective = effectiveOrNull(event);
        if (effective == null) return BigDecimal.ZERO;
        if (!"APPROVED".equals(effective.getResultingStatus())) return BigDecimal.ZERO;
        if (!"PENALTY".equals(effective.getAdjustmentType())) return BigDecimal.ZERO;
        return effective.getAmount() != null ? effective.getAmount() : BigDecimal.ZERO;
    }

    // ───── Single-bill convenience (does a DB lookup each call — avoid in loops) ─────

    public BigDecimal computeAdjustmentEffect(StudentFeePayment bill) {
        return computeAdjustmentEffect(getCurrentEvent(bill));
    }

    public BigDecimal computeConcession(StudentFeePayment bill) {
        return computeConcession(getCurrentEvent(bill));
    }

    public BigDecimal computePenalty(StudentFeePayment bill) {
        return computePenalty(getCurrentEvent(bill));
    }
}
