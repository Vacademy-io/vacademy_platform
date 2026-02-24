package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeeAllocationLedgerDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.StudentFeePaymentDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAllocationLedger;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAllocationLedgerRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;

import java.util.Collections;
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
}
