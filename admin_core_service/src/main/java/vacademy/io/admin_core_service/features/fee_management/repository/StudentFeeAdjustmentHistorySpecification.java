package vacademy.io.admin_core_service.features.fee_management.repository;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Dynamic filter builder for institute-wide adjustment history queries.
 * Any null/empty filter is skipped — no WHERE clause noise.
 */
public class StudentFeeAdjustmentHistorySpecification {

    public static Specification<StudentFeeAdjustmentHistory> withFilters(
            String instituteId,
            Collection<String> eventTypes,
            Collection<String> adjustmentTypes,
            Collection<String> resultingStatuses,
            String actorUserId,
            LocalDate startDate,
            LocalDate endDate,
            Collection<String> studentFeePaymentIds  // pre-resolved from student search
    ) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();

            preds.add(cb.equal(root.get("instituteId"), instituteId));

            if (eventTypes != null && !eventTypes.isEmpty()) {
                preds.add(root.get("eventType").in(eventTypes));
            }
            if (adjustmentTypes != null && !adjustmentTypes.isEmpty()) {
                preds.add(root.get("adjustmentType").in(adjustmentTypes));
            }
            if (resultingStatuses != null && !resultingStatuses.isEmpty()) {
                preds.add(root.get("resultingStatus").in(resultingStatuses));
            }
            if (actorUserId != null && !actorUserId.isBlank()) {
                preds.add(cb.equal(root.get("actorUserId"), actorUserId));
            }
            if (startDate != null) {
                preds.add(cb.greaterThanOrEqualTo(
                        root.get("createdAt"), startDate.atStartOfDay()));
            }
            if (endDate != null) {
                preds.add(cb.lessThan(
                        root.get("createdAt"), endDate.plusDays(1).atStartOfDay()));
            }
            if (studentFeePaymentIds != null) {
                if (studentFeePaymentIds.isEmpty()) {
                    // Caller signalled "no matches" for studentSearch → force zero rows
                    preds.add(cb.disjunction());
                } else {
                    preds.add(root.get("studentFeePaymentId").in(studentFeePaymentIds));
                }
            }

            return cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
