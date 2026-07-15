package vacademy.io.admin_core_service.features.fee_management.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentEventType;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentStatus;
import vacademy.io.admin_core_service.features.fee_management.enums.AdjustmentType;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAdjustmentHistoryRepository;
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
    private StudentFeeAdjustmentHistoryRepository adjustmentHistoryRepository;

    @Autowired
    private InstituteSettingService instituteSettingService;

    @Autowired
    private vacademy.io.admin_core_service.features.user_account.service.UserAccountLedgerService userAccountLedgerService;

    public record AdjustmentResult(StudentFeePayment bill, StudentFeeAdjustmentHistory event) {}

    @Transactional
    public AdjustmentResult submitAdjustment(
            String studentFeePaymentId,
            String userId,
            BigDecimal amount,
            AdjustmentType type,
            String reason,
            String instituteId,
            CustomUserDetails actor
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
            throw new VacademyException("student_fee_payment " + studentFeePaymentId
                    + " does not belong to user " + userId);
        }

        // Block submit if current adjustment is active (pending / approved / rejected).
        // Admin must retract before submitting a new one. Matches UX behaviour.
        StudentFeeAdjustmentHistory currentEvent = loadCurrentEvent(bill);
        if (currentEvent != null) {
            String status = currentEvent.getResultingStatus();
            if (AdjustmentStatus.PENDING_FOR_APPROVAL.name().equals(status)
                    || AdjustmentStatus.APPROVED.name().equals(status)
                    || AdjustmentStatus.REJECTED.name().equals(status)) {
                throw new VacademyException("An active adjustment already exists ("
                        + status + "). Retract it before submitting a new one.");
            }
        }

        BigDecimal amountExpected = bill.getAmountExpected() != null
                ? bill.getAmountExpected() : BigDecimal.ZERO;
        if (type == AdjustmentType.CONCESSION && amount.compareTo(amountExpected) > 0) {
            throw new VacademyException("Concession amount cannot exceed amount_expected ("
                    + amountExpected + ")");
        }

        // Backfill institute_id on bill if missing (kept for backward compat)
        String resolvedInstituteId = StringUtils.hasText(bill.getInstituteId())
                ? bill.getInstituteId() : instituteId;
        if (bill.getInstituteId() == null && StringUtils.hasText(resolvedInstituteId)) {
            bill.setInstituteId(resolvedInstituteId);
        }
        if (!StringUtils.hasText(resolvedInstituteId)) {
            throw new VacademyException("institute_id could not be resolved for bill "
                    + studentFeePaymentId);
        }

        boolean autoApproved = (type == AdjustmentType.PENALTY);
        String resultingStatus = autoApproved
                ? AdjustmentStatus.APPROVED.name()
                : AdjustmentStatus.PENDING_FOR_APPROVAL.name();

        StudentFeeAdjustmentHistory event = StudentFeeAdjustmentHistory.builder()
                .studentFeePaymentId(studentFeePaymentId)
                .instituteId(resolvedInstituteId)
                .eventType(AdjustmentEventType.SUBMITTED.name())
                .adjustmentType(type.name())
                .amount(amount)
                .reason(reason)
                .resultingStatus(resultingStatus)
                .actorUserId(actorUserIdOrThrow(actor))
                .actorRole(resolveActorRole(actor))
                .previousEventId(null)
                .metadata(autoApproved ? "{\"auto_approved\": true}" : null)
                .build();
        event = adjustmentHistoryRepository.save(event);

        bill.setCurrentAdjustmentHistoryId(event.getId());
        StudentFeePayment savedBill = studentFeePaymentRepository.save(bill);

        // Ledger: penalties are auto-approved, record debit immediately
        if (autoApproved) {
            userAccountLedgerService.recordDebitPenalty(
                    bill.getUserId(), resolvedInstituteId, amount, "INR",
                    "STUDENT_FEE_PAYMENT", studentFeePaymentId,
                    event.getId(), "Penalty applied");
        }

        log.info("Adjustment submitted: billId={}, userId={}, type={}, amount={}, status={}, auto={}",
                studentFeePaymentId, userId, type, amount, resultingStatus, autoApproved);
        return new AdjustmentResult(savedBill, event);
    }

    @Transactional
    public AdjustmentResult reviewAdjustment(
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

        if (!canApproveAdjustment(reviewer, instituteId)) {
            throw new VacademyException(
                    "You do not have permission to approve/reject adjustments for this institute");
        }

        StudentFeePayment bill = findBillOrThrow(studentFeePaymentId);
        StudentFeeAdjustmentHistory currentEvent = loadCurrentEvent(bill);
        if (currentEvent == null
                || !AdjustmentStatus.PENDING_FOR_APPROVAL.name()
                        .equals(currentEvent.getResultingStatus())) {
            String status = currentEvent == null ? "NONE" : currentEvent.getResultingStatus();
            throw new VacademyException(
                    "Adjustment is not pending for approval. Current status: " + status);
        }

        AdjustmentEventType eventType = (action == AdjustmentStatus.APPROVED)
                ? AdjustmentEventType.APPROVED : AdjustmentEventType.REJECTED;

        StudentFeeAdjustmentHistory event = StudentFeeAdjustmentHistory.builder()
                .studentFeePaymentId(studentFeePaymentId)
                .instituteId(currentEvent.getInstituteId())
                .eventType(eventType.name())
                .adjustmentType(currentEvent.getAdjustmentType())
                .amount(currentEvent.getAmount())
                .reason(currentEvent.getReason())
                .resultingStatus(action.name())
                .actorUserId(actorUserIdOrThrow(reviewer))
                .actorRole(resolveActorRole(reviewer))
                .previousEventId(currentEvent.getId())
                .build();
        event = adjustmentHistoryRepository.save(event);

        bill.setCurrentAdjustmentHistoryId(event.getId());
        StudentFeePayment savedBill = studentFeePaymentRepository.save(bill);

        // Ledger: approved concession = credit adjustment
        if (action == AdjustmentStatus.APPROVED
                && AdjustmentType.CONCESSION.name().equals(currentEvent.getAdjustmentType())) {
            userAccountLedgerService.recordCreditAdjustment(
                    bill.getUserId(), currentEvent.getInstituteId(),
                    currentEvent.getAmount(), "INR",
                    "STUDENT_FEE_PAYMENT", studentFeePaymentId,
                    event.getId(), "Concession approved");
        }

        log.info("Adjustment reviewed: billId={}, action={}, reviewer={}",
                studentFeePaymentId, action, reviewer.getUserId());
        return new AdjustmentResult(savedBill, event);
    }

    @Transactional
    public AdjustmentResult retractAdjustment(
            String studentFeePaymentId,
            String instituteId,
            CustomUserDetails actor
    ) {
        validateRequired(studentFeePaymentId, "studentFeePaymentId");

        StudentFeePayment bill = findBillOrThrow(studentFeePaymentId);
        StudentFeeAdjustmentHistory currentEvent = loadCurrentEvent(bill);
        if (currentEvent == null) {
            throw new VacademyException("No adjustment exists to retract");
        }
        if (AdjustmentEventType.RETRACTED.name().equals(currentEvent.getEventType())) {
            throw new VacademyException("Adjustment is already retracted");
        }

        StudentFeeAdjustmentHistory event = StudentFeeAdjustmentHistory.builder()
                .studentFeePaymentId(studentFeePaymentId)
                .instituteId(currentEvent.getInstituteId())
                .eventType(AdjustmentEventType.RETRACTED.name())
                .adjustmentType(currentEvent.getAdjustmentType())
                .amount(currentEvent.getAmount())
                .reason(currentEvent.getReason())
                .resultingStatus(AdjustmentEventType.RETRACTED.name())
                .actorUserId(actorUserIdOrThrow(actor))
                .actorRole(resolveActorRole(actor))
                .previousEventId(currentEvent.getId())
                .build();
        event = adjustmentHistoryRepository.save(event);

        bill.setCurrentAdjustmentHistoryId(event.getId());
        StudentFeePayment savedBill = studentFeePaymentRepository.save(bill);

        log.info("Adjustment retracted: billId={}, previousStatus={}",
                studentFeePaymentId, currentEvent.getResultingStatus());
        return new AdjustmentResult(savedBill, event);
    }

    public boolean canApproveAdjustment(CustomUserDetails user, String instituteId) {
        List<String> approvalRoles = getApprovalRoles(instituteId);
        if (approvalRoles.isEmpty()) {
            return user.isRootUser();
        }
        return approvalRoles.stream()
                .anyMatch(role -> user.getAuthorities().stream()
                        .anyMatch(auth -> auth.getAuthority().equalsIgnoreCase(role)));
    }

    private StudentFeeAdjustmentHistory loadCurrentEvent(StudentFeePayment bill) {
        if (!StringUtils.hasText(bill.getCurrentAdjustmentHistoryId())) {
            return null;
        }
        return adjustmentHistoryRepository.findById(bill.getCurrentAdjustmentHistoryId())
                .orElse(null);
    }

    @SuppressWarnings("unchecked")
    private List<String> getApprovalRoles(String instituteId) {
        try {
            Object settingData = instituteSettingService
                    .getSettingByInstituteIdAndKey(instituteId, SETTING_KEY);
            if (settingData instanceof Map) {
                Map<String, Object> settingMap = (Map<String, Object>) settingData;
                Object roles = settingMap.get("approvalRoles");
                if (roles instanceof List) {
                    return (List<String>) roles;
                }
            }
        } catch (Exception e) {
            log.warn("Could not read FEE_ADJUSTMENT_SETTINGS for institute {}: {}",
                    instituteId, e.getMessage());
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

    private String actorUserIdOrThrow(CustomUserDetails user) {
        if (user == null || !StringUtils.hasText(user.getUserId())) {
            throw new VacademyException("Unable to resolve acting user");
        }
        return user.getUserId();
    }

    private String resolveActorRole(CustomUserDetails user) {
        if (user == null || user.getAuthorities() == null || user.getAuthorities().isEmpty()) {
            return null;
        }
        return user.getAuthorities().iterator().next().getAuthority();
    }
}
