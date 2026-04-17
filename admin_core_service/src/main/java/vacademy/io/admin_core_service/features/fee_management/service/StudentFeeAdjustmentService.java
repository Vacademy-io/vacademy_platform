package vacademy.io.admin_core_service.features.fee_management.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentStatus;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentType;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class StudentFeeAdjustmentService {

    private static final Logger log = LoggerFactory.getLogger(StudentFeeAdjustmentService.class);
    private static final String SETTING_KEY = "FEE_ADJUSTMENT_SETTINGS";

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Transactional
    public StudentFeePayment submitAdjustment(
            String studentFeePaymentId,
            String userId,
            BigDecimal amount,
            AdjustmentType type,
            String reason,
            String instituteId
    ) {
        validateRequired(studentFeePaymentId, "studentFeePaymentId");
        validateRequired(userId, "userId");
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new VacademyException("adjustment_amount must be > 0");
        }
        if (type == null) {
            throw new VacademyException("adjustment_type is required");
        }

        StudentFeePayment bill = findBillOrThrow(studentFeePaymentId);

        if (!userId.equals(bill.getUserId())) {
            throw new VacademyException("student_fee_payment " + studentFeePaymentId + " does not belong to user " + userId);
        }

        // Cannot submit if a concession is already pending
        if (AdjustmentStatus.PENDING_FOR_APPROVAL.name().equals(bill.getAdjustmentStatus())) {
            throw new VacademyException("An adjustment is already pending for approval. Retract it before submitting a new one.");
        }

        BigDecimal amountExpected = bill.getAmountExpected() != null ? bill.getAmountExpected() : BigDecimal.ZERO;

        if (type == AdjustmentType.CONCESSION && amount.compareTo(amountExpected) > 0) {
            throw new VacademyException("Concession amount cannot exceed amount_expected ("
                    + amountExpected + ")");
        }

        // Backfill institute_id if missing
        if (bill.getInstituteId() == null && StringUtils.hasText(instituteId)) {
            bill.setInstituteId(instituteId);
        }

        bill.setAdjustmentAmount(amount);
        bill.setAdjustmentType(type.name());
        bill.setAdjustmentReason(reason);
        bill.setAdjustmentStatus(AdjustmentStatus.PENDING_FOR_APPROVAL.name());

        StudentFeePayment saved = studentFeePaymentRepository.save(bill);
        log.info("Adjustment submitted: billId={}, userId={}, type={}, amount={}, status={}",
                studentFeePaymentId, userId, type, amount, saved.getAdjustmentStatus());
        return saved;
    }

    @Transactional
    public StudentFeePayment reviewAdjustment(
            String studentFeePaymentId,
            AdjustmentStatus action,
            String instituteId,
            CustomUserDetails reviewer
    ) {
        validateRequired(studentFeePaymentId, "studentFeePaymentId");
        validateRequired(instituteId, "instituteId");

        if (action != AdjustmentStatus.APPROVED && action != AdjustmentStatus.REJECTED) {
            throw new VacademyException("action must be APPROVED or REJECTED");
        }

        // Check reviewer has an approval role
        if (!canApproveAdjustment(reviewer, instituteId)) {
            throw new VacademyException("You do not have permission to approve/reject adjustments for this institute");
        }

        StudentFeePayment bill = findBillOrThrow(studentFeePaymentId);

        if (!AdjustmentStatus.PENDING_FOR_APPROVAL.name().equals(bill.getAdjustmentStatus())) {
            throw new VacademyException("Adjustment is not pending for approval. Current status: " + bill.getAdjustmentStatus());
        }

        bill.setAdjustmentStatus(action.name());

        StudentFeePayment saved = studentFeePaymentRepository.save(bill);
        log.info("Adjustment reviewed: billId={}, action={}, reviewer={}",
                studentFeePaymentId, action, reviewer.getUserId());
        return saved;
    }

    @Transactional
    public StudentFeePayment retractAdjustment(
            String studentFeePaymentId,
            String instituteId
    ) {
        validateRequired(studentFeePaymentId, "studentFeePaymentId");

        StudentFeePayment bill = findBillOrThrow(studentFeePaymentId);

        String currentStatus = bill.getAdjustmentStatus();
        if (currentStatus == null) {
            throw new VacademyException("No adjustment exists to retract");
        }

        // Reset all adjustment fields
        bill.setAdjustmentAmount(BigDecimal.ZERO);
        bill.setAdjustmentReason(null);
        bill.setAdjustmentType(null);
        bill.setAdjustmentStatus(null);

        StudentFeePayment saved = studentFeePaymentRepository.save(bill);
        log.info("Adjustment retracted: billId={}, previousStatus={}", studentFeePaymentId, currentStatus);
        return saved;
    }

    public boolean canApproveAdjustment(CustomUserDetails user, String instituteId) {
        List<String> approvalRoles = getApprovalRoles(instituteId);
        if (approvalRoles.isEmpty()) {
            // No roles configured — only root users can approve
            return user.isRootUser();
        }
        return approvalRoles.stream()
                .anyMatch(role -> user.getAuthorities().stream()
                        .anyMatch(auth -> auth.getAuthority().equalsIgnoreCase(role)));
    }

    @SuppressWarnings("unchecked")
    private List<String> getApprovalRoles(String instituteId) {
        try {
            Object settingData = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, SETTING_KEY);
            if (settingData instanceof Map) {
                Map<String, Object> settingMap = (Map<String, Object>) settingData;
                Object roles = settingMap.get("approvalRoles");
                if (roles instanceof List) {
                    return (List<String>) roles;
                }
            }
        } catch (Exception e) {
            log.warn("Could not read FEE_ADJUSTMENT_SETTINGS for institute {}: {}", instituteId, e.getMessage());
        }
        return Collections.emptyList();
    }

    private StudentFeePayment findBillOrThrow(String id) {
        return studentFeePaymentRepository.findById(id)
                .orElseThrow(() -> new VacademyException("student_fee_payment not found: " + id));
    }

    private void validateRequired(String value, String fieldName) {
        if (!StringUtils.hasText(value)) {
            throw new VacademyException(fieldName + " is required");
        }
    }
}
