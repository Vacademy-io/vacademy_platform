package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
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

import java.math.BigDecimal;
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
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private ComplexPaymentOptionRepository complexPaymentOptionRepository;

    @Autowired
    private UserPlanRepository userPlanRepository;

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

        return studentFeeAllocationLedgerRepository.findByStudentFeePaymentIdInOrderByCreatedAtDesc(billIds).stream()
                .map(ledger -> mapToLedgerDTO(ledger, billIdToMeta.get(ledger.getStudentFeePaymentId())))
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
                null
        ).getContent();

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
                .collect(Collectors.toMap(ComplexPaymentOption::getId, ComplexPaymentOption::getName, (a, b) -> a));

        Map<String, String> asvIdToFeeTypeId = assignedFeeValueRepository.findAllById(asvIds).stream()
                .collect(Collectors.toMap(AssignedFeeValue::getId, AssignedFeeValue::getFeeTypeId, (a, b) -> a));

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
                            feeType != null ? feeType.getDescription() : null
                    )
            );
        }
        return billIdToMeta;
    }

    private record FeeMeta(
            String cpoName,
            String feeTypeName,
            String feeTypeCode,
            String feeTypeDescription
    ) {
    }
}
