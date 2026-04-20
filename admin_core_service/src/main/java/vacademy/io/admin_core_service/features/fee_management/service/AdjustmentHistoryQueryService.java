package vacademy.io.admin_core_service.features.fee_management.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.fee_management.dto.AdjustmentHistoryDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.EnrichedAdjustmentHistoryDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.InstituteAdjustmentHistoryFilterDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAdjustmentHistoryRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAdjustmentHistorySpecification;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read-side service for adjustment history.
 * - Per-installment history: powers the "History" section in the AdjustmentDialog.
 * - Institute-wide history: powers the tabbed Adjustment Approvals page
 *   (Pending / Approved / Rejected / All).
 *
 * Pagination is always DB-level via Spring {@link Pageable}.
 */
@Service
@Slf4j
public class AdjustmentHistoryQueryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;

    @Autowired
    private StudentFeeAdjustmentHistoryRepository adjustmentHistoryRepository;

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private ComplexPaymentOptionRepository complexPaymentOptionRepository;

    @Autowired
    private AuthService authService;

    @PersistenceContext
    private EntityManager entityManager;

    // ─────────────────────────────────────────────────────────────
    //  Per-installment history (AdjustmentDialog History section)
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AdjustmentHistoryDTO> getHistoryForInstallment(
            String studentFeePaymentId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<StudentFeeAdjustmentHistory> eventsPage = adjustmentHistoryRepository
                .findByStudentFeePaymentIdOrderByCreatedAtDesc(studentFeePaymentId, pageable);

        if (eventsPage.isEmpty()) {
            return eventsPage.map(e -> toBaseDTO(e, null));
        }

        Map<String, UserDTO> userMap = resolveActors(eventsPage.getContent());
        return eventsPage.map(event -> toBaseDTO(event, actorName(event, userMap)));
    }

    // ─────────────────────────────────────────────────────────────
    //  Institute-wide history (Adjustment Approvals page)
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<EnrichedAdjustmentHistoryDTO> getInstituteHistory(
            String instituteId, InstituteAdjustmentHistoryFilterDTO filter) {

        int page = filter != null && filter.getPage() != null && filter.getPage() >= 0
                ? filter.getPage() : 0;
        int size = filter != null && filter.getSize() != null
                && filter.getSize() > 0 && filter.getSize() <= MAX_PAGE_SIZE
                ? filter.getSize() : DEFAULT_PAGE_SIZE;

        // Resolve studentSearch → set of student_fee_payment_ids. Null = no filter.
        Collection<String> billIdFilter = resolveStudentSearchToBillIds(
                instituteId,
                filter != null ? filter.getStudentSearch() : null);

        Specification<StudentFeeAdjustmentHistory> spec =
                StudentFeeAdjustmentHistorySpecification.withFilters(
                        instituteId,
                        filter != null ? filter.getEventTypes() : null,
                        filter != null ? filter.getAdjustmentTypes() : null,
                        filter != null ? filter.getResultingStatuses() : null,
                        filter != null ? filter.getActorUserId() : null,
                        filter != null ? filter.getStartDate() : null,
                        filter != null ? filter.getEndDate() : null,
                        billIdFilter);

        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<StudentFeeAdjustmentHistory> eventsPage =
                adjustmentHistoryRepository.findAll(spec, pageable);

        if (eventsPage.isEmpty()) {
            return eventsPage.map(e -> toEnrichedDTO(e, null, null, null));
        }

        Map<String, UserDTO> userMap = resolveActors(eventsPage.getContent());
        EnrichmentContext ctx = buildEnrichmentContext(eventsPage.getContent());

        return eventsPage.map(event -> toEnrichedDTO(event, actorName(event, userMap), ctx,
                userMap));
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    private Collection<String> resolveStudentSearchToBillIds(String instituteId, String studentSearch) {
        if (!StringUtils.hasText(studentSearch)) return null;
        // The `users` table lives in the auth_service database — we can't query it
        // directly from admin_core_service. Delegate name/email/mobile search to
        // auth_service via HTTP (HMAC-signed). It returns up to 10 matches.
        List<UserDTO> matchedUsers;
        try {
            matchedUsers = authService.autosuggestUsers(instituteId, studentSearch.trim());
        } catch (Exception e) {
            log.warn("autosuggestUsers failed for query='{}': {}", studentSearch, e.getMessage());
            matchedUsers = List.of();
        }
        log.info("Adjustment history student-search: query='{}' matched {} users",
                studentSearch, matchedUsers.size());

        if (matchedUsers.isEmpty()) {
            return Collections.emptyList(); // signals "force zero rows" to the spec
        }

        List<String> matchedUserIds = matchedUsers.stream()
                .map(UserDTO::getId)
                .filter(StringUtils::hasText)
                .distinct()
                .collect(Collectors.toList());

        List<String> billIds = entityManager.createQuery(
                        "SELECT sfp.id FROM StudentFeePayment sfp " +
                        "WHERE sfp.instituteId = :instituteId " +
                        "  AND sfp.userId IN :userIds",
                        String.class)
                .setParameter("instituteId", instituteId)
                .setParameter("userIds", matchedUserIds)
                .getResultList();

        log.info("Adjustment history student-search: userIds={}, billIds={}",
                matchedUserIds.size(), billIds.size());

        return billIds.isEmpty() ? Collections.emptyList() : billIds;
    }

    private Map<String, UserDTO> resolveActors(List<StudentFeeAdjustmentHistory> events) {
        List<String> actorIds = events.stream()
                .map(StudentFeeAdjustmentHistory::getActorUserId)
                .filter(id -> id != null && !id.isBlank() && !"MIGRATION".equals(id))
                .distinct()
                .collect(Collectors.toList());
        if (actorIds.isEmpty()) return Map.of();
        try {
            return authService.getUsersFromAuthServiceByUserIds(actorIds).stream()
                    .collect(Collectors.toMap(UserDTO::getId, Function.identity(), (a, b) -> a));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String actorName(StudentFeeAdjustmentHistory event, Map<String, UserDTO> userMap) {
        UserDTO user = userMap.get(event.getActorUserId());
        if (user != null) return user.getFullName();
        return "MIGRATION".equals(event.getActorUserId()) ? "System (migration)" : null;
    }

    private AdjustmentHistoryDTO toBaseDTO(StudentFeeAdjustmentHistory e, String actorName) {
        return AdjustmentHistoryDTO.builder()
                .id(e.getId())
                .studentFeePaymentId(e.getStudentFeePaymentId())
                .eventType(e.getEventType())
                .adjustmentType(e.getAdjustmentType())
                .amount(e.getAmount())
                .reason(e.getReason())
                .resultingStatus(e.getResultingStatus())
                .actorUserId(e.getActorUserId())
                .actorName(actorName)
                .actorRole(e.getActorRole())
                .previousEventId(e.getPreviousEventId())
                .metadata(e.getMetadata())
                .createdAt(e.getCreatedAt())
                .build();
    }

    // Fetch all the referenced bills + their fee meta + the student users, in batch.
    private EnrichmentContext buildEnrichmentContext(List<StudentFeeAdjustmentHistory> events) {
        Set<String> billIds = events.stream()
                .map(StudentFeeAdjustmentHistory::getStudentFeePaymentId)
                .filter(StringUtils::hasText)
                .collect(Collectors.toSet());

        Map<String, StudentFeePayment> billMap = billIds.isEmpty()
                ? Map.of()
                : studentFeePaymentRepository.findAllById(billIds).stream()
                        .collect(Collectors.toMap(StudentFeePayment::getId, Function.identity(),
                                (a, b) -> a));

        Set<String> cpoIds = new HashSet<>();
        Set<String> asvIds = new HashSet<>();
        Set<String> studentUserIds = new HashSet<>();
        for (StudentFeePayment bill : billMap.values()) {
            if (StringUtils.hasText(bill.getCpoId())) cpoIds.add(bill.getCpoId());
            if (StringUtils.hasText(bill.getAsvId())) asvIds.add(bill.getAsvId());
            if (StringUtils.hasText(bill.getUserId())) studentUserIds.add(bill.getUserId());
        }

        Map<String, String> cpoIdToName = cpoIds.isEmpty() ? Map.of()
                : complexPaymentOptionRepository.findAllById(cpoIds).stream()
                        .collect(Collectors.toMap(ComplexPaymentOption::getId,
                                ComplexPaymentOption::getName, (a, b) -> a));

        Map<String, String> asvIdToFeeTypeId = asvIds.isEmpty() ? Map.of()
                : assignedFeeValueRepository.findAllById(asvIds).stream()
                        .collect(Collectors.toMap(AssignedFeeValue::getId,
                                AssignedFeeValue::getFeeTypeId, (a, b) -> a));

        Set<String> feeTypeIds = new HashSet<>(asvIdToFeeTypeId.values());
        feeTypeIds.remove(null);
        Map<String, String> feeTypeIdToName = feeTypeIds.isEmpty() ? Map.of()
                : feeTypeRepository.findAllById(feeTypeIds).stream()
                        .collect(Collectors.toMap(FeeType::getId, FeeType::getName, (a, b) -> a));

        Map<String, UserDTO> studentUserMap = Map.of();
        if (!studentUserIds.isEmpty()) {
            try {
                studentUserMap = authService.getUsersFromAuthServiceByUserIds(
                                new java.util.ArrayList<>(studentUserIds)).stream()
                        .collect(Collectors.toMap(UserDTO::getId, Function.identity(), (a, b) -> a));
            } catch (Exception ignored) {
            }
        }

        return new EnrichmentContext(billMap, cpoIdToName, asvIdToFeeTypeId, feeTypeIdToName,
                studentUserMap);
    }

    private EnrichedAdjustmentHistoryDTO toEnrichedDTO(
            StudentFeeAdjustmentHistory e,
            String actorName,
            EnrichmentContext ctx,
            Map<String, UserDTO> actorMap) {

        EnrichedAdjustmentHistoryDTO.EnrichedAdjustmentHistoryDTOBuilder b =
                EnrichedAdjustmentHistoryDTO.builder()
                        .id(e.getId())
                        .studentFeePaymentId(e.getStudentFeePaymentId())
                        .eventType(e.getEventType())
                        .adjustmentType(e.getAdjustmentType())
                        .amount(e.getAmount())
                        .reason(e.getReason())
                        .resultingStatus(e.getResultingStatus())
                        .actorUserId(e.getActorUserId())
                        .actorName(actorName)
                        .actorRole(e.getActorRole())
                        .previousEventId(e.getPreviousEventId())
                        .metadata(e.getMetadata())
                        .createdAt(e.getCreatedAt());

        if (ctx == null) return b.build();

        StudentFeePayment bill = ctx.billMap.get(e.getStudentFeePaymentId());
        if (bill != null) {
            b.installmentDueDate(bill.getDueDate());
            b.studentUserId(bill.getUserId());

            UserDTO student = ctx.studentUserMap.get(bill.getUserId());
            if (student != null) {
                b.studentName(student.getFullName());
                b.studentPhone(student.getMobileNumber());
            }

            if (StringUtils.hasText(bill.getCpoId())) {
                b.cpoName(ctx.cpoIdToName.get(bill.getCpoId()));
            }
            String feeTypeId = StringUtils.hasText(bill.getAsvId())
                    ? ctx.asvIdToFeeTypeId.get(bill.getAsvId()) : null;
            if (StringUtils.hasText(feeTypeId)) {
                b.feeTypeName(ctx.feeTypeIdToName.get(feeTypeId));
            }
        }

        return b.build();
    }

    private record EnrichmentContext(
            Map<String, StudentFeePayment> billMap,
            Map<String, String> cpoIdToName,
            Map<String, String> asvIdToFeeTypeId,
            Map<String, String> feeTypeIdToName,
            Map<String, UserDTO> studentUserMap
    ) {}
}
