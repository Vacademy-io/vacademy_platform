package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.dto.FeeSearchFilterDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.CollectionDashboardRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.CollectionDashboardResponseDTO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentRowDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.*;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
public class FeeTrackingService {

        @Autowired
        private StudentFeePaymentRepository studentFeePaymentRepository;

        @Autowired
        private StudentFeeAllocationLedgerRepository studentFeeAllocationLedgerRepository;

        @Autowired
        private UserPlanRepository userPlanRepository;

        @Autowired
        private AftInstallmentRepository aftInstallmentRepository;

        @Autowired
        private FeeTypeRepository feeTypeRepository;

        @Autowired
        private AuthService authService;

        @Autowired
        private AssignedFeeValueRepository assignedFeeValueRepository;

        @Autowired
        private ComplexPaymentOptionRepository complexPaymentOptionRepository;

        @Autowired
        private PackageSessionLearnerInvitationToPaymentOptionRepository packageSessionInviteRepo;

        @PersistenceContext
        private EntityManager entityManager;

        private StudentFeePaymentDTO mapToPaymentDTO(StudentFeePayment entity) {
                return StudentFeePaymentDTO.builder()
                                .id(entity.getId())
                                .userPlanId(entity.getUserPlanId())
                                .cpoId(entity.getCpoId())
                                .amountExpected(entity.getAmountExpected())
                                .discountAmount(entity.getDiscountAmount())
                                .discountReason(entity.getDiscountReason())
                                .amountPaid(entity.getAmountPaid())
                                .dueDate(entity.getDueDate())
                                .status(entity.getStatus())
                                .build();
        }

        private StudentFeeAllocationLedgerDTO mapToLedgerDTO(StudentFeeAllocationLedger entity) {
                return StudentFeeAllocationLedgerDTO.builder()
                                .id(entity.getId())
                                .paymentLogId(entity.getPaymentLogId())
                                .studentFeePaymentId(entity.getStudentFeePaymentId())
                                .amountAllocated(entity.getAmountAllocated())
                                .allocationType(entity.getAllocationType())
                                .remarks(entity.getRemarks())
                                .createdAt(entity.getCreatedAt())
                                .build();
        }

        /**
         * Admin fee roster search — powers the Manage Finances table.
         * <p>
         * Flow:
         * 1. If studentSearchQuery is provided, resolve matching userIds from
         * auth-service.
         * 2. Build a dynamic JPA Specification using the active filters.
         * 3. Execute the paginated, sorted query against student_fee_payment.
         * 4. Collect all unique userIds from the page result and batch-fetch user info.
         * 5. Enrich each row DTO with studentName, studentEmail, feeTypeName,
         * installmentNumber.
         */
        @Transactional(readOnly = true)
        public Page<StudentFeePaymentRowDTO> searchFeePayments(String instituteId, FeeSearchFilterDTO request) {
                FeeSearchFilterDTO.Filters filters = request.getFilters();

                // Step 1: Resolve studentSearchQuery to userIds if provided
                List<String> matchedUserIds = resolveStudentSearchQuery(filters);

                // Step 2: Build the dynamic specification
                Specification<StudentFeePayment> spec = StudentFeePaymentSpecification
                                .withFilters(instituteId, filters, matchedUserIds);

                // Step 3: Build pageable with sort
                Sort.Direction direction = "ASC".equalsIgnoreCase(request.getSortDirection())
                                ? Sort.Direction.ASC
                                : Sort.Direction.DESC;
                String sortField = StringUtils.hasText(request.getSortBy()) ? request.getSortBy() : "dueDate";
                PageRequest pageable = PageRequest.of(request.getPage(), request.getSize(),
                                Sort.by(direction, sortField));

                // Step 4: Execute the paginated DB query
                Page<StudentFeePayment> paymentPage = studentFeePaymentRepository.findAll(spec, pageable);

                // Step 5: Batch-fetch all student info from auth-service
                List<String> userIds = paymentPage.getContent().stream()
                                .map(StudentFeePayment::getUserId)
                                .distinct()
                                .collect(Collectors.toList());
                Map<String, UserDTO> userMap = fetchUserMap(userIds);

                // Step 6: Batch-fetch FeeType names and AftInstallment numbers
                List<String> asvIds = paymentPage.getContent().stream()
                                .map(StudentFeePayment::getAsvId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .collect(Collectors.toList());
                Map<String, String> feeTypeNameMap = fetchFeeTypeNameMap(asvIds);

                List<String> installmentIds = paymentPage.getContent().stream()
                                .map(StudentFeePayment::getIId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .collect(Collectors.toList());
                Map<String, Integer> installmentNumberMap = fetchInstallmentNumberMap(installmentIds);

                // Step 7: Batch-fetch packageSession IDs for each payment via enroll_invite +
                // cpo_id
                List<String> userPlanIds = paymentPage.getContent().stream()
                                .map(StudentFeePayment::getUserPlanId)
                                .distinct()
                                .collect(Collectors.toList());
                Map<String, List<String>> packageSessionMap = fetchPackageSessionMap(userPlanIds);

                // Step 8: Map to response DTOs
                List<StudentFeePaymentRowDTO> rows = paymentPage.getContent().stream()
                                .map(sfp -> toRowDTO(sfp, userMap, feeTypeNameMap, installmentNumberMap,
                                                packageSessionMap))
                                .collect(Collectors.toList());

                return new PageImpl<>(rows, pageable, paymentPage.getTotalElements());
        }

        /**
         * TODO: When the auth-service exposes a search-by-name/email endpoint,
         * implement this to return matching userIds and pass them as a filter
         * to the DB query (so the DB never sees external user data).
         *
         * For now, the studentSearchQuery filter is gracefully skipped —
         * all other filters (status, CPO, feeType, dates, packageSession) work fully.
         */
        private List<String> resolveStudentSearchQuery(FeeSearchFilterDTO.Filters filters) {
                if (filters == null || !StringUtils.hasText(filters.getStudentSearchQuery())) {
                        return null; // No search query provided — no user filter applied
                }
                // Auth-service does not yet have a search-by-name endpoint.
                // Returning null here means this filter is silently ignored.
                // Replace this with a real auth-service call when available.
                log.warn("studentSearchQuery filter is not yet supported (auth-service search endpoint missing). " +
                                "Ignoring filter value: '{}'", filters.getStudentSearchQuery());
                return null;
        }

        private Map<String, UserDTO> fetchUserMap(List<String> userIds) {
                if (userIds == null || userIds.isEmpty())
                        return Map.of();
                try {
                        List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);
                        return users.stream().collect(Collectors.toMap(UserDTO::getId, Function.identity(),
                                        (a, b) -> a));
                } catch (Exception e) {
                        log.warn("Failed to fetch user details for fee roster enrichment: {}", e.getMessage());
                        return Map.of();
                }
        }

        private Map<String, String> fetchFeeTypeNameMap(List<String> asvIds) {
                if (asvIds.isEmpty())
                        return Map.of();

                List<AssignedFeeValue> afvs = assignedFeeValueRepository.findAllById(asvIds);
                List<String> feeTypeIds = afvs.stream()
                                .map(AssignedFeeValue::getFeeTypeId)
                                .distinct()
                                .collect(Collectors.toList());

                Map<String, String> feeTypeNames = feeTypeRepository.findAllById(feeTypeIds).stream()
                                .collect(Collectors.toMap(FeeType::getId, FeeType::getName, (a, b) -> a));

                return afvs.stream().collect(Collectors.toMap(
                                AssignedFeeValue::getId,
                                afv -> feeTypeNames.getOrDefault(afv.getFeeTypeId(), "N/A"),
                                (a, b) -> a));
        }

        private Map<String, Integer> fetchInstallmentNumberMap(List<String> installmentIds) {
                if (installmentIds.isEmpty())
                        return Map.of();
                return aftInstallmentRepository.findAllById(installmentIds).stream()
                                .collect(Collectors.toMap(AftInstallment::getId, AftInstallment::getInstallmentNumber,
                                                (a, b) -> a));
        }

        /**
         * Batch-fetches package session IDs for all user plans in the current page.
         * Returns a map: userPlanId -> List<packageSessionId>
         * Uses: student_fee_payment.user_plan_id -> user_plan.enroll_invite_id + cpo_id
         * -> package_session_learner_invitation_to_payment_option.package_session_id
         */
        private Map<String, List<String>> fetchPackageSessionMap(List<String> userPlanIds) {
                if (userPlanIds == null || userPlanIds.isEmpty()) {
                        log.info("[PKG-SESSION] userPlanIds is null/empty, skipping query");
                        return Collections.emptyMap();
                }
                log.info("[PKG-SESSION] Querying for {} userPlanIds: {}", userPlanIds.size(), userPlanIds);
                try {
                        List<Object[]> rows = packageSessionInviteRepo.findPackageSessionIdsByUserPlanIds(userPlanIds);
                        log.info("[PKG-SESSION] Query returned {} rows", rows.size());
                        Map<String, List<String>> result = new HashMap<>();
                        for (Object[] row : rows) {
                                String userPlanId = (String) row[0];
                                String packageSessionId = (String) row[1];
                                log.info("[PKG-SESSION] userPlanId={} -> packageSessionId={}", userPlanId,
                                                packageSessionId);
                                result.computeIfAbsent(userPlanId, k -> new ArrayList<>()).add(packageSessionId);
                        }
                        return result;
                } catch (Exception e) {
                        log.warn("[PKG-SESSION] Query FAILED: {}", e.getMessage(), e);
                        return Collections.emptyMap();
                }
        }

        private StudentFeePaymentRowDTO toRowDTO(
                        StudentFeePayment sfp,
                        Map<String, UserDTO> userMap,
                        Map<String, String> feeTypeNameMap,
                        Map<String, Integer> installmentNumberMap,
                        Map<String, List<String>> packageSessionMap) {

                UserDTO user = userMap.get(sfp.getUserId());
                BigDecimal expected = sfp.getAmountExpected() != null ? sfp.getAmountExpected() : BigDecimal.ZERO;
                BigDecimal discount = sfp.getDiscountAmount() != null ? sfp.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal paid = sfp.getAmountPaid() != null ? sfp.getAmountPaid() : BigDecimal.ZERO;
                BigDecimal totalDue = expected.subtract(discount).subtract(paid);

                return StudentFeePaymentRowDTO.builder()
                                .paymentId(sfp.getId())
                                .userId(sfp.getUserId())
                                .studentName(user != null ? user.getFullName() : sfp.getUserId())
                                .studentEmail(user != null ? user.getEmail() : null)
                                .packageSessionIds(packageSessionMap.getOrDefault(sfp.getUserPlanId(),
                                                Collections.emptyList()))
                                .feeTypeName(sfp.getAsvId() != null
                                                ? feeTypeNameMap.getOrDefault(sfp.getAsvId(), "N/A")
                                                : "N/A")
                                .installmentNumber(sfp.getIId() != null
                                                ? installmentNumberMap.getOrDefault(sfp.getIId(), null)
                                                : null)
                                .amountExpected(expected)
                                .discountAmount(discount)
                                .amountPaid(paid)
                                .totalDue(totalDue)
                                .dueDate(sfp.getDueDate())
                                .status(sfp.getStatus())
                                .build();
        }

        @Transactional(readOnly = true)
        public CollectionDashboardResponseDTO getCollectionDashboard(CollectionDashboardRequestDTO request) {
                String instituteId = request.getInstituteId();
                boolean hasSession = StringUtils.hasText(request.getSessionId());
                String sessionId = hasSession ? request.getSessionId() : null;

                List<String> feeTypes = (request.getFeeTypes() != null)
                                ? request.getFeeTypes().stream().filter(StringUtils::hasText)
                                                .collect(Collectors.toList())
                                : Collections.emptyList();
                boolean hasFeeTypes = !feeTypes.isEmpty();

                // Shared SQL fragments
                String sessionClause = hasSession ? buildSessionClause() : "";
                String feeTypeClause = hasFeeTypes ? buildFeeTypeClause(feeTypes) : "";

                // ── Query 1: Overall summary ──────────────────────────────────────────
                String summarySql = "SELECT " +
                                "  COALESCE(SUM(sfp.amount_expected - COALESCE(sfp.discount_amount,0)),0), " +
                                "  COALESCE(SUM(CASE WHEN sfp.due_date <= CURRENT_DATE " +
                                "    THEN (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) ELSE 0 END),0), " +
                                "  COALESCE(SUM(sfp.amount_paid),0), " +
                                "  COALESCE(SUM(CASE " +
                                "    WHEN sfp.due_date <= CURRENT_DATE " +
                                "      AND sfp.status NOT IN ('WAIVED') " +
                                "      AND sfp.amount_paid < (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) " +
                                "    THEN (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) - sfp.amount_paid " +
                                "    ELSE 0 END),0) " +
                                "FROM student_fee_payment sfp " +
                                "JOIN complex_payment_option cpo ON sfp.cpo_id = cpo.id " +
                                "WHERE cpo.institute_id = :instituteId " +
                                "  AND sfp.status NOT IN ('CANCELLED','DROPPED') " +
                                sessionClause + feeTypeClause;

                jakarta.persistence.Query summaryQ = entityManager.createNativeQuery(summarySql);
                bindParams(summaryQ, instituteId, hasSession, sessionId, feeTypes);
                Object[] sr = (Object[]) summaryQ.getSingleResult();

                BigDecimal projectedRevenue = toBD(sr[0]);
                BigDecimal tillNowExpected = toBD(sr[1]);
                BigDecimal tillNowCollected = toBD(sr[2]);
                BigDecimal totalOverdue = toBD(sr[3]);
                BigDecimal totalDue = projectedRevenue.subtract(tillNowCollected);
                double collectionRate = calcRate(tillNowCollected, tillNowExpected);

                CollectionDashboardResponseDTO.SummaryDTO summary = CollectionDashboardResponseDTO.SummaryDTO.builder()
                                .projectedRevenue(projectedRevenue)
                                .tillNowExpected(tillNowExpected)
                                .tillNowCollected(tillNowCollected)
                                .totalOverdue(totalOverdue)
                                .totalDue(totalDue)
                                .collectionRate(collectionRate)
                                .build();

                CollectionDashboardResponseDTO.PipelineDTO pipeline = CollectionDashboardResponseDTO.PipelineDTO
                                .builder()
                                .projectedRevenue(projectedRevenue)
                                .expectedToDate(tillNowExpected)
                                .collectedToDate(tillNowCollected)
                                .totalOverdue(totalOverdue)
                                .totalDue(totalDue)
                                .build();

                // ── Query 2: Class-wise breakdown ─────────────────────────────────────
                String classWiseSql = "SELECT " +
                                "  cpo.name, " +
                                "  COALESCE(SUM(sfp.amount_expected - COALESCE(sfp.discount_amount,0)),0), " +
                                "  COALESCE(SUM(CASE WHEN sfp.due_date <= CURRENT_DATE " +
                                "    THEN (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) ELSE 0 END),0), " +
                                "  COALESCE(SUM(sfp.amount_paid),0), " +
                                "  COALESCE(SUM(CASE " +
                                "    WHEN sfp.due_date <= CURRENT_DATE " +
                                "      AND sfp.status NOT IN ('WAIVED') " +
                                "      AND sfp.amount_paid < (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) " +
                                "    THEN (sfp.amount_expected - COALESCE(sfp.discount_amount,0)) - sfp.amount_paid " +
                                "    ELSE 0 END),0) " +
                                "FROM student_fee_payment sfp " +
                                "JOIN complex_payment_option cpo ON sfp.cpo_id = cpo.id " +
                                "WHERE cpo.institute_id = :instituteId " +
                                "  AND sfp.status NOT IN ('CANCELLED','DROPPED') " +
                                sessionClause + feeTypeClause +
                                "GROUP BY cpo.id, cpo.name ORDER BY cpo.name";

                jakarta.persistence.Query classQ = entityManager.createNativeQuery(classWiseSql);
                bindParams(classQ, instituteId, hasSession, sessionId, feeTypes);
                @SuppressWarnings("unchecked")
                List<Object[]> classRows = classQ.getResultList();

                List<CollectionDashboardResponseDTO.ClassWiseCollectionDTO> classWiseDetails = classRows.stream()
                                .map(row -> {
                                        BigDecimal cProj = toBD(row[1]);
                                        BigDecimal cExpDate = toBD(row[2]);
                                        BigDecimal cCollected = toBD(row[3]);
                                        BigDecimal cOverdue = toBD(row[4]);
                                        return CollectionDashboardResponseDTO.ClassWiseCollectionDTO.builder()
                                                        .className((String) row[0])
                                                        .projectedRevenue(cProj)
                                                        .expectedToDate(cExpDate)
                                                        .collectedToDate(cCollected)
                                                        .collectionRate(calcRate(cCollected, cExpDate))
                                                        .totalOverdue(cOverdue)
                                                        .build();
                                }).collect(Collectors.toList());

                // ── Query 3: Payment mode insights ────────────────────────────────────
                String modeSql = "SELECT pl.vendor, COALESCE(SUM(sal.amount_allocated),0) " +
                                "FROM student_fee_allocation_ledger sal " +
                                "JOIN payment_log pl ON sal.payment_log_id = pl.id " +
                                "JOIN student_fee_payment sfp ON sal.student_fee_payment_id = sfp.id " +
                                "JOIN complex_payment_option cpo ON sfp.cpo_id = cpo.id " +
                                "WHERE cpo.institute_id = :instituteId " +
                                "  AND sal.transaction_type NOT IN ('REFUND','BOUNCE_REVERSAL') " +
                                "  AND pl.payment_status = 'PAID' " +
                                sessionClause + feeTypeClause +
                                "GROUP BY pl.vendor";

                jakarta.persistence.Query modeQ = entityManager.createNativeQuery(modeSql);
                bindParams(modeQ, instituteId, hasSession, sessionId, feeTypes);
                @SuppressWarnings("unchecked")
                List<Object[]> modeRows = modeQ.getResultList();

                // Aggregate by human-readable label (multiple vendors → same label)
                Map<String, BigDecimal> labelTotals = new LinkedHashMap<>();
                BigDecimal modeGrandTotal = BigDecimal.ZERO;
                for (Object[] row : modeRows) {
                        String vendor = row[0] != null ? row[0].toString() : "UNKNOWN";
                        BigDecimal amt = toBD(row[1]);
                        String label = vendorToLabel(vendor);
                        labelTotals.merge(label, amt, BigDecimal::add);
                        modeGrandTotal = modeGrandTotal.add(amt);
                }
                final BigDecimal totalMode = modeGrandTotal;
                List<CollectionDashboardResponseDTO.PaymentModeInsightDTO> paymentModeInsights = labelTotals.entrySet()
                                .stream()
                                .map(e -> {
                                        double pct = totalMode.compareTo(BigDecimal.ZERO) > 0
                                                        ? e.getValue().divide(totalMode, 4,
                                                                        java.math.RoundingMode.HALF_UP)
                                                                        .multiply(new BigDecimal("100")).doubleValue()
                                                        : 0.0;
                                        return CollectionDashboardResponseDTO.PaymentModeInsightDTO.builder()
                                                        .mode(e.getKey())
                                                        .percentage(pct)
                                                        .color(labelToColor(e.getKey()))
                                                        .build();
                                })
                                .sorted((a, b) -> Double.compare(b.getPercentage(), a.getPercentage()))
                                .collect(Collectors.toList());

                return CollectionDashboardResponseDTO.builder()
                                .summary(summary)
                                .pipeline(pipeline)
                                .classWiseDetails(classWiseDetails)
                                .paymentModeInsights(paymentModeInsights)
                                .build();
        }

        private BigDecimal toBD(Object val) {
                if (val == null)
                        return BigDecimal.ZERO;
                if (val instanceof BigDecimal)
                        return (BigDecimal) val;
                return new BigDecimal(val.toString());
        }

        /** Collection rate capped floor at 0, expressed as a percentage (0-100+). */
        private double calcRate(BigDecimal collected, BigDecimal expected) {
                if (expected == null || expected.compareTo(BigDecimal.ZERO) == 0)
                        return 0.0;
                return collected.divide(expected, 4, java.math.RoundingMode.HALF_UP)
                                .multiply(new BigDecimal("100")).doubleValue();
        }

        /** Subquery clause to scope results to a single package session via cpo_id. */
        private String buildSessionClause() {
                return "  AND sfp.cpo_id IN (" +
                                "SELECT psl.cpo_id FROM package_session_learner_invitation_to_payment_option psl " +
                                "WHERE psl.package_session_id = :sessionId) ";
        }

        /**
         * Builds an IN clause for feeTypes using indexed named params (:ft0, :ft1,
         * ...).
         */
        private String buildFeeTypeClause(List<String> feeTypes) {
                StringBuilder clause = new StringBuilder("  AND sfp.fee_type_id IN (");
                for (int i = 0; i < feeTypes.size(); i++) {
                        if (i > 0)
                                clause.append(",");
                        clause.append(":ft").append(i);
                }
                return clause.append(") ").toString();
        }

        /** Binds all common parameters to a native EntityManager query. */
        private void bindParams(jakarta.persistence.Query q, String instituteId,
                        boolean hasSession, String sessionId, List<String> feeTypes) {
                q.setParameter("instituteId", instituteId);
                if (hasSession)
                        q.setParameter("sessionId", sessionId);
                for (int i = 0; i < feeTypes.size(); i++) {
                        q.setParameter("ft" + i, feeTypes.get(i));
                }
        }

        private String vendorToLabel(String vendor) {
                switch (vendor.toUpperCase()) {
                        case "RAZORPAY":
                        case "CASHFREE":
                        case "STRIPE":
                                return "Online Portal";
                        case "OFFLINE":
                        case "MANUAL":
                                return "Cash";
                        case "EWAY":
                                return "Bank Transfer";
                        default:
                                return "Other";
                }
        }

        private String labelToColor(String label) {
                switch (label) {
                        case "Online Portal":
                                return "#10b981";
                        case "Bank Transfer":
                                return "#f59e0b";
                        case "Cash":
                                return "#6366f1";
                        default:
                                return "#94a3b8";
                }
        }

        @Transactional(readOnly = true)
        public List<StudentFeePaymentDTO> getStudentDues(String userId, String instituteId) {
                List<StudentFeePayment> allBills = fetchBillsForUserAndInstitute(userId, instituteId);

                if (allBills == null || allBills.isEmpty()) {
                        return Collections.emptyList();
                }

                Map<String, FeeMeta> billIdToMeta = buildFeeMetaMap(allBills);

                return allBills.stream()
                                .filter(bill -> !"PAID".equals(bill.getStatus()))
                                .map(bill -> mapToPaymentDTO(bill, billIdToMeta.get(bill.getId())))
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<StudentFeeAllocationLedgerDTO> getStudentReceipts(String userId, String instituteId) {
                List<StudentFeePayment> bills = fetchBillsForUserAndInstitute(userId, instituteId);
                if (bills == null || bills.isEmpty()) {
                        return Collections.emptyList();
                }

                List<String> billIds = bills.stream().map(StudentFeePayment::getId).collect(Collectors.toList());
                Map<String, FeeMeta> billIdToMeta = buildFeeMetaMap(bills);

                return studentFeeAllocationLedgerRepository.findByStudentFeePaymentIdInOrderByCreatedAtDesc(billIds)
                                .stream()
                                .map(ledger -> mapToLedgerDTO(ledger,
                                                billIdToMeta.get(ledger.getStudentFeePaymentId())))
                                .collect(Collectors.toList());
        }

        private List<StudentFeePayment> fetchBillsForUserAndInstitute(String userId, String instituteId) {
                if (instituteId == null || instituteId.isBlank()) {
                        return studentFeePaymentRepository.findByUserId(userId);
                }

                List<UserPlan> plans = userPlanRepository.findByUserIdAndInstituteIdWithFilters(
                                userId,
                                instituteId,
                                List.of("ACTIVE", "PENDING", "PENDING_FOR_PAYMENT", "EXPIRED", "TERMINATED"),
                                null).getContent();

                if (plans == null || plans.isEmpty()) {
                        return Collections.emptyList();
                }

                List<String> planIds = plans.stream().map(UserPlan::getId).collect(Collectors.toList());
                return studentFeePaymentRepository.findByUserPlanIdIn(planIds);
        }

        private StudentFeePaymentDTO mapToPaymentDTO(StudentFeePayment entity, FeeMeta meta) {
                BigDecimal expected = entity.getAmountExpected() != null ? entity.getAmountExpected() : BigDecimal.ZERO;
                BigDecimal discount = entity.getDiscountAmount() != null ? entity.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal paid = entity.getAmountPaid() != null ? entity.getAmountPaid() : BigDecimal.ZERO;
                BigDecimal amountDue = expected.subtract(discount).subtract(paid);

                Boolean isOverdue = false;
                Long daysOverdue = null;
                if (entity.getDueDate() != null && amountDue.compareTo(BigDecimal.ZERO) > 0) {
                        LocalDate due = entity.getDueDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
                        LocalDate today = LocalDate.now(ZoneId.systemDefault());
                        if (due.isBefore(today)) {
                                isOverdue = true;
                                daysOverdue = ChronoUnit.DAYS.between(due, today);
                        }
                }

                return StudentFeePaymentDTO.builder()
                                .id(entity.getId())
                                .userPlanId(entity.getUserPlanId())
                                .cpoId(entity.getCpoId())
                                .cpoName(meta != null ? meta.cpoName : null)
                                .feeTypeName(meta != null ? meta.feeTypeName : null)
                                .feeTypeCode(meta != null ? meta.feeTypeCode : null)
                                .feeTypeDescription(meta != null ? meta.feeTypeDescription : null)
                                .amountExpected(entity.getAmountExpected())
                                .discountAmount(entity.getDiscountAmount())
                                .discountReason(entity.getDiscountReason())
                                .amountPaid(entity.getAmountPaid())
                                .dueDate(entity.getDueDate())
                                .status(entity.getStatus())
                                .amountDue(amountDue)
                                .isOverdue(isOverdue)
                                .daysOverdue(daysOverdue)
                                .build();
        }

        private StudentFeeAllocationLedgerDTO mapToLedgerDTO(StudentFeeAllocationLedger entity, FeeMeta meta) {
                return StudentFeeAllocationLedgerDTO.builder()
                                .id(entity.getId())
                                .paymentLogId(entity.getPaymentLogId())
                                .studentFeePaymentId(entity.getStudentFeePaymentId())
                                .cpoName(meta != null ? meta.cpoName : null)
                                .feeTypeName(meta != null ? meta.feeTypeName : null)
                                .feeTypeCode(meta != null ? meta.feeTypeCode : null)
                                .feeTypeDescription(meta != null ? meta.feeTypeDescription : null)
                                .amountAllocated(entity.getAmountAllocated())
                                .allocationType(entity.getAllocationType())
                                .remarks(entity.getRemarks())
                                .createdAt(entity.getCreatedAt())
                                .build();
        }

        private Map<String, FeeMeta> buildFeeMetaMap(List<StudentFeePayment> bills) {
                if (bills == null || bills.isEmpty()) {
                        return Collections.emptyMap();
                }

                List<String> cpoIds = bills.stream()
                                .map(StudentFeePayment::getCpoId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();

                List<String> asvIds = bills.stream()
                                .map(StudentFeePayment::getAsvId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();

                Map<String, String> cpoIdToName = complexPaymentOptionRepository.findAllById(cpoIds).stream()
                                .collect(Collectors.toMap(ComplexPaymentOption::getId, ComplexPaymentOption::getName,
                                                (a, b) -> a));

                Map<String, String> asvIdToFeeTypeId = assignedFeeValueRepository.findAllById(asvIds).stream()
                                .collect(Collectors.toMap(AssignedFeeValue::getId, AssignedFeeValue::getFeeTypeId,
                                                (a, b) -> a));

                List<String> feeTypeIds = asvIdToFeeTypeId.values().stream()
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();

                Map<String, FeeType> feeTypeIdToEntity = feeTypeRepository.findAllById(feeTypeIds).stream()
                                .collect(Collectors.toMap(FeeType::getId, ft -> ft, (a, b) -> a));

                Map<String, FeeMeta> billIdToMeta = new HashMap<>();
                for (StudentFeePayment bill : bills) {
                        String cpoName = bill.getCpoId() != null ? cpoIdToName.get(bill.getCpoId()) : null;

                        String feeTypeId = bill.getAsvId() != null ? asvIdToFeeTypeId.get(bill.getAsvId()) : null;
                        FeeType feeType = feeTypeId != null ? feeTypeIdToEntity.get(feeTypeId) : null;

                        billIdToMeta.put(
                                        bill.getId(),
                                        new FeeMeta(
                                                        cpoName,
                                                        feeType != null ? feeType.getName() : null,
                                                        feeType != null ? feeType.getCode() : null,
                                                        feeType != null ? feeType.getDescription() : null));
                }
                return billIdToMeta;
        }

        private record FeeMeta(
                        String cpoName,
                        String feeTypeName,
                        String feeTypeCode,
                        String feeTypeDescription) {
        }
}
