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
import vacademy.io.admin_core_service.features.fee_management.dto.FeeSearchFilterDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentRowDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.*;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.math.BigDecimal;
import java.util.*;
import java.util.function.Function;
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

    @Transactional(readOnly = true)
    public List<StudentFeePaymentDTO> getStudentDues(String userId, String instituteId) {
        List<UserPlan> plans = userPlanRepository.findByUserIdAndInstituteIdWithFilters(
                userId, instituteId, List.of("ACTIVE", "PENDING", "PENDING_FOR_PAYMENT"), null).getContent();

        if (plans.isEmpty()) {
            return Collections.emptyList();
        }

        List<StudentFeePayment> allBills = studentFeePaymentRepository.findByUserPlanId(plans.get(0).getId());

        return allBills.stream()
                .filter(bill -> !"PAID".equals(bill.getStatus()))
                .map(this::mapToPaymentDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudentFeeAllocationLedgerDTO> getStudentReceipts(String userId, String instituteId) {
        List<UserPlan> plans = userPlanRepository.findByUserIdAndInstituteIdWithFilters(
                userId, instituteId, List.of("ACTIVE", "PENDING", "PENDING_FOR_PAYMENT", "EXPIRED", "TERMINATED"), null)
                .getContent();

        if (plans.isEmpty()) {
            return Collections.emptyList();
        }

        List<StudentFeePayment> allBills = studentFeePaymentRepository.findByUserPlanId(plans.get(0).getId());

        return allBills.stream()
                .flatMap(bill -> studentFeeAllocationLedgerRepository.findByStudentFeePaymentId(bill.getId()).stream())
                .map(this::mapToLedgerDTO)
                .collect(Collectors.toList());
    }

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
     * 1. If studentSearchQuery is provided, resolve matching userIds from auth-service.
     * 2. Build a dynamic JPA Specification using the active filters.
     * 3. Execute the paginated, sorted query against student_fee_payment.
     * 4. Collect all unique userIds from the page result and batch-fetch user info.
     * 5. Enrich each row DTO with studentName, studentEmail, feeTypeName, installmentNumber.
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
                ? Sort.Direction.ASC : Sort.Direction.DESC;
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
        List<String> feeTypeIds = paymentPage.getContent().stream()
                .map(StudentFeePayment::getFeeTypeId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        Map<String, String> feeTypeNameMap = fetchFeeTypeNameMap(feeTypeIds);

        List<String> installmentIds = paymentPage.getContent().stream()
                .map(StudentFeePayment::getIId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        Map<String, Integer> installmentNumberMap = fetchInstallmentNumberMap(installmentIds);

        // Step 7: Map to response DTOs
        List<StudentFeePaymentRowDTO> rows = paymentPage.getContent().stream()
                .map(sfp -> toRowDTO(sfp, userMap, feeTypeNameMap, installmentNumberMap))
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
        if (userIds == null || userIds.isEmpty()) return Map.of();
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(userIds);
            return users.stream().collect(Collectors.toMap(UserDTO::getId, Function.identity(),
                    (a, b) -> a));
        } catch (Exception e) {
            log.warn("Failed to fetch user details for fee roster enrichment: {}", e.getMessage());
            return Map.of();
        }
    }

    private Map<String, String> fetchFeeTypeNameMap(List<String> feeTypeIds) {
        if (feeTypeIds.isEmpty()) return Map.of();
        return feeTypeRepository.findAllById(feeTypeIds).stream()
                .collect(Collectors.toMap(FeeType::getId, FeeType::getName, (a, b) -> a));
    }

    private Map<String, Integer> fetchInstallmentNumberMap(List<String> installmentIds) {
        if (installmentIds.isEmpty()) return Map.of();
        return aftInstallmentRepository.findAllById(installmentIds).stream()
                .collect(Collectors.toMap(AftInstallment::getId, AftInstallment::getInstallmentNumber,
                        (a, b) -> a));
    }

    private StudentFeePaymentRowDTO toRowDTO(
            StudentFeePayment sfp,
            Map<String, UserDTO> userMap,
            Map<String, String> feeTypeNameMap,
            Map<String, Integer> installmentNumberMap) {

        UserDTO user = userMap.get(sfp.getUserId());
        BigDecimal expected = sfp.getAmountExpected() != null ? sfp.getAmountExpected() : BigDecimal.ZERO;
        BigDecimal discount = sfp.getDiscountAmount() != null ? sfp.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal paid = sfp.getAmountPaid() != null ? sfp.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal totalDue = expected.subtract(discount).subtract(paid);

        return StudentFeePaymentRowDTO.builder()
                .paymentId(sfp.getId())
                .studentId(sfp.getUserId())
                .studentName(user != null ? user.getFullName() : sfp.getUserId())
                .studentEmail(user != null ? user.getEmail() : null)
                .feeTypeName(feeTypeNameMap.getOrDefault(sfp.getFeeTypeId(), "N/A"))
                .installmentNumber(installmentNumberMap.getOrDefault(sfp.getIId(), null))
                .amountExpected(expected)
                .discountAmount(discount)
                .amountPaid(paid)
                .totalDue(totalDue)
                .dueDate(sfp.getDueDate())
                .status(sfp.getStatus())
                .build();
    }
}
