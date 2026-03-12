package vacademy.io.admin_core_service.features.fee_management.repository;

import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;
import vacademy.io.admin_core_service.features.fee_management.dto.FeeSearchFilterDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;

import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic JPA Specification builder for StudentFeePayment search queries.
 * Each active filter adds a predicate to the WHERE clause.
 */
public class StudentFeePaymentSpecification {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    public static Specification<StudentFeePayment> withFilters(
            String instituteId,
            FeeSearchFilterDTO.Filters filters,
            List<String> matchedUserIds) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // --- 1. Institute filter: subquery for CPO IDs based on institute_id ---
            // SELECT cpo.id FROM ComplexPaymentOption cpo WHERE cpo.instituteId = :instituteId
            Subquery<String> cpoIdSubquery = query.subquery(String.class);
            Root<ComplexPaymentOption> cpoSubRoot = cpoIdSubquery.from(ComplexPaymentOption.class);
            cpoIdSubquery.select(cpoSubRoot.get("id"));
            cpoIdSubquery.where(cb.equal(cpoSubRoot.get("instituteId"), instituteId));
            predicates.add(root.get("cpoId").in(cpoIdSubquery));

            if (filters == null) {
                return cb.and(predicates.toArray(new Predicate[0]));
            }

            // --- 2. Filter by CPO IDs ---
            if (filters.getCpoIds() != null && !filters.getCpoIds().isEmpty()) {
                predicates.add(root.get("cpoId").in(filters.getCpoIds()));
            }

            // --- 3. Filter by Fee Type IDs (direct column on student_fee_payment) ---
            if (filters.getFeeTypeIds() != null && !filters.getFeeTypeIds().isEmpty()) {
                predicates.add(root.get("feeTypeId").in(filters.getFeeTypeIds()));
            }

            // --- 4. Filter by statuses ---
            if (filters.getStatuses() != null && !filters.getStatuses().isEmpty()) {
                predicates.add(root.get("status").in(filters.getStatuses()));
            }

            // --- 5. Filter by due date range ---
            if (filters.getDueDateRange() != null) {
                FeeSearchFilterDTO.DueDateRange range = filters.getDueDateRange();
                if (range.getStartDate() != null && !range.getStartDate().isBlank()) {
                    Date startDate = Date.valueOf(LocalDate.parse(range.getStartDate(), DATE_FORMATTER));
                    predicates.add(cb.greaterThanOrEqualTo(root.get("dueDate"), startDate));
                }
                if (range.getEndDate() != null && !range.getEndDate().isBlank()) {
                    Date endDate = Date.valueOf(LocalDate.parse(range.getEndDate(), DATE_FORMATTER));
                    predicates.add(cb.lessThanOrEqualTo(root.get("dueDate"), endDate));
                }
            }

            // --- 6. Filter by student user IDs (resolved from auth-service search) ---
            // matchedUserIds is populated by the service layer when studentSearchQuery is provided
            if (matchedUserIds != null && !matchedUserIds.isEmpty()) {
                predicates.add(root.get("userId").in(matchedUserIds));
            }

            // --- 7. Filter by package session IDs ---
            // package_session_ids is stored as TEXT (comma-separated or JSON string)
            // We use LIKE for partial match across the stored text
            if (filters.getPackageSessionIds() != null && !filters.getPackageSessionIds().isEmpty()) {
                List<Predicate> packagePredicates = new ArrayList<>();
                for (String psId : filters.getPackageSessionIds()) {
                    packagePredicates.add(cb.like(root.get("packageSessionIds"), "%" + psId + "%"));
                }
                predicates.add(cb.or(packagePredicates.toArray(new Predicate[0])));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
