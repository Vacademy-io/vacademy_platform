package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.ApplyCpoDiscountRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.CpoInstallmentRowDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.CpoSideViewInstallmentsResponseDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.CpoUserPlanSummaryDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.ModifyInstallmentRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.dto.RecordOfflinePaymentRequestDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDiscountJson;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentLogStatusEnum;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.service.PaymentLogService;
import vacademy.io.admin_core_service.features.user_subscription.util.PaymentOptionJsonDiscountAccessor;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.payment.enums.PaymentGateway;
import vacademy.io.common.payment.enums.PaymentStatusEnum;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Backs the admin side-view "payment history" tab for CPO UserPlans.
 *
 * <p>Composes the installment list + discount snapshot, dispatches the
 * single-installment / CPO-level discount edits to {@link CpoDiscountService},
 * and owns the offline-payment recording path (mirrors the bulk-assign
 * side-effect helper but isolated to a single UserPlan).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CpoSideViewService {

    private final UserPlanRepository userPlanRepository;
    private final StudentFeePaymentRepository studentFeePaymentRepository;
    private final CpoDiscountService cpoDiscountService;
    private final PaymentLogService paymentLogService;
    private final PaymentLogRepository paymentLogRepository;
    private final FeeLedgerAllocationService feeLedgerAllocationService;
    private final InvoiceService invoiceService;
    private final ComplexPaymentOptionRepository complexPaymentOptionRepository;

    // -------------------------------------------------------------------- read

    /**
     * One row per CPO UserPlan the user is enrolled in (each row a compact
     * totals view). Drives the side-view listing before drilling in.
     *
     * <p>Derived from {@code student_fee_payment.findByUserId} → group by
     * userPlanId → load each UserPlan + its CPO. Skips UserPlans whose
     * PaymentOption is not a CPO mirror.
     */
    public List<CpoUserPlanSummaryDTO> listForUser(String userId) {
        List<StudentFeePayment> all = studentFeePaymentRepository.findByUserId(userId);
        if (all.isEmpty()) return List.of();

        Map<String, List<StudentFeePayment>> byPlan = new java.util.LinkedHashMap<>();
        for (StudentFeePayment sfp : all) {
            if (sfp.getUserPlanId() == null) continue;
            byPlan.computeIfAbsent(sfp.getUserPlanId(), k -> new ArrayList<>()).add(sfp);
        }

        List<CpoUserPlanSummaryDTO> out = new ArrayList<>(byPlan.size());
        for (Map.Entry<String, List<StudentFeePayment>> entry : byPlan.entrySet()) {
            UserPlan plan = userPlanRepository.findById(entry.getKey()).orElse(null);
            if (plan == null) continue;

            List<StudentFeePayment> rows = entry.getValue();
            BigDecimal gross = BigDecimal.ZERO, net = BigDecimal.ZERO, paid = BigDecimal.ZERO;
            String cpoId = null;
            for (StudentFeePayment sfp : rows) {
                gross = gross.add(nz(sfp.getOriginalAmount()));
                net = net.add(nz(sfp.getAmountExpected()));
                paid = paid.add(nz(sfp.getAmountPaid()));
                if (cpoId == null) cpoId = sfp.getCpoId();
            }

            String cpoName = null;
            if (cpoId != null) {
                ComplexPaymentOption cpo = complexPaymentOptionRepository.findById(cpoId).orElse(null);
                if (cpo != null) cpoName = cpo.getName();
            }

            out.add(CpoUserPlanSummaryDTO.builder()
                    .userPlanId(plan.getId())
                    .cpoId(cpoId)
                    .cpoName(cpoName)
                    .paymentOptionId(plan.getPaymentOptionId())
                    .paymentOptionName(plan.getPaymentOption() != null ? plan.getPaymentOption().getName() : null)
                    .status(plan.getStatus())
                    .grossTotal(gross)
                    .netTotal(net)
                    .paidTotal(paid)
                    .outstandingTotal(net.subtract(paid))
                    .installmentCount(rows.size())
                    .startDate(plan.getStartDate())
                    .endDate(plan.getEndDate())
                    .build());
        }
        return out;
    }

    public CpoSideViewInstallmentsResponseDTO list(String userPlanId) {
        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("UserPlan not found: " + userPlanId));

        List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserPlanId(userPlanId);
        // Render in chronological order so the side-view shows installment 1
        // first, then 2, etc. due_date is the natural sort key; rows with no
        // due_date sort last; ids break ties so the order is stable across reloads.
        sfps.sort((a, b) -> {
            java.util.Date da = a.getDueDate();
            java.util.Date db = b.getDueDate();
            if (da == null && db == null) return a.getId().compareTo(b.getId());
            if (da == null) return 1;
            if (db == null) return -1;
            int cmp = da.compareTo(db);
            return cmp != 0 ? cmp : a.getId().compareTo(b.getId());
        });
        UserPlanDiscountJson snapshot = parseSnapshot(plan);

        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        List<CpoInstallmentRowDTO> rows = new ArrayList<>(sfps.size());

        for (StudentFeePayment sfp : sfps) {
            BigDecimal originalAmount = nz(sfp.getOriginalAmount());
            BigDecimal amountExpected = nz(sfp.getAmountExpected());
            BigDecimal amountPaid = nz(sfp.getAmountPaid());

            gross = gross.add(originalAmount);
            net = net.add(amountExpected);
            paid = paid.add(amountPaid);

            rows.add(CpoInstallmentRowDTO.builder()
                    .id(sfp.getId())
                    .aftInstallmentId(sfp.getIId())
                    .originalAmount(originalAmount)
                    .amountExpected(amountExpected)
                    .amountPaid(amountPaid)
                    .outstanding(amountExpected.subtract(amountPaid))
                    .startDate(sfp.getStartDate())
                    .dueDate(sfp.getDueDate())
                    .status(sfp.getStatus())
                    .installmentDiscount(snapshot.getInstallmentDiscounts() != null
                            ? snapshot.getInstallmentDiscounts().get(sfp.getId())
                            : null)
                    .manualAmountOverride(snapshot.getManualAmountOverrides() != null
                            ? snapshot.getManualAmountOverrides().get(sfp.getId())
                            : null)
                    .build());
        }

        String cpoId = sfps.isEmpty() ? null : sfps.get(0).getCpoId();
        return CpoSideViewInstallmentsResponseDTO.builder()
                .userPlanId(plan.getId())
                .userId(plan.getUserId())
                .cpoId(cpoId)
                .grossTotal(gross)
                .netTotal(net)
                .paidTotal(paid)
                .outstandingTotal(net.subtract(paid))
                .cpoDiscount(snapshot.getCpoDiscount())
                .installments(rows)
                .history(snapshot.getHistory())
                .build();
    }

    // ------------------------------------------------------------------- write

    @Transactional
    public CpoSideViewInstallmentsResponseDTO modifyInstallment(
            String sfpId, ModifyInstallmentRequestDTO req, String appliedBy) {

        StudentFeePayment sfp = studentFeePaymentRepository.findById(sfpId)
                .orElseThrow(() -> new VacademyException("StudentFeePayment not found: " + sfpId));

        if (req.getStartDate() != null || req.getDueDate() != null) {
            cpoDiscountService.setInstallmentDates(sfpId, req.getStartDate(), req.getDueDate(), appliedBy);
        }

        if (req.isClearAmountOverride()) {
            cpoDiscountService.clearInstallmentAmountOverride(sfpId, appliedBy);
        } else if (req.getAmount() != null) {
            cpoDiscountService.setInstallmentAmount(
                    sfpId, BigDecimal.valueOf(req.getAmount()),
                    req.getDiscount() != null ? req.getDiscount().getReason() : null,
                    appliedBy);
        }

        if (req.isClearDiscount()) {
            cpoDiscountService.setInstallmentDiscount(sfpId, null, appliedBy);
        } else if (req.getDiscount() != null && req.getAmount() == null) {
            // Discount is only applied as a discount when no explicit amount was supplied
            // (otherwise the amount override has already absorbed the reason).
            cpoDiscountService.setInstallmentDiscount(sfpId, req.getDiscount(), appliedBy);
        }

        return list(sfp.getUserPlanId());
    }

    @Transactional
    public CpoSideViewInstallmentsResponseDTO setCpoDiscount(
            String userPlanId, ApplyCpoDiscountRequestDTO req, String appliedBy) {

        if (req.getDiscount() == null && !req.isRemove()) {
            throw new VacademyException("Either discount or remove=true must be supplied");
        }
        cpoDiscountService.setCpoDiscount(userPlanId, req.isRemove() ? null : req.getDiscount(), appliedBy);
        return list(userPlanId);
    }

    @Transactional
    public CpoSideViewInstallmentsResponseDTO recordOfflinePayment(
            String userPlanId, RecordOfflinePaymentRequestDTO req, String appliedBy) {

        // Audit log up front. We had a prod incident where an offline payment
        // landed as ₹1 instead of the intended amount; logging the exact wire
        // payload lets us forensically distinguish "admin typed 1" from
        // "request was malformed" from "form state was wrong at submit time".
        log.info("recordOfflinePayment: userPlanId={}, amount={}, paymentDate={}, reference={}, "
                        + "currency={}, generateInvoice={}, appliedBy={}",
                userPlanId, req.getAmount(), req.getPaymentDate(), req.getReference(),
                req.getCurrency(), req.isGenerateInvoice(), appliedBy);

        if (req.getAmount() == null || req.getAmount() <= 0.0) {
            throw new VacademyException("Payment amount must be positive");
        }

        UserPlan plan = userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("UserPlan not found: " + userPlanId));

        String currency = req.getCurrency() != null
                ? req.getCurrency()
                : (plan.getPaymentPlan() != null && plan.getPaymentPlan().getCurrency() != null
                        ? plan.getPaymentPlan().getCurrency() : "INR");
        Date paymentDate = req.getPaymentDate() != null ? req.getPaymentDate() : new Date();

        String paymentLogId = paymentLogService.createPaymentLog(
                plan.getUserId(),
                req.getAmount(),
                PaymentGateway.MANUAL.name(),
                PaymentGateway.MANUAL.name(),
                currency,
                plan,
                null,
                paymentDate);

        Map<String, Object> paymentSpecificData = new HashMap<>();
        if (req.getReference() != null && !req.getReference().isBlank()) {
            paymentSpecificData.put("transaction_id", req.getReference());
        }
        paymentSpecificData.put("source", "SIDE_VIEW_CPO");
        paymentSpecificData.put("recorded_by", appliedBy);
        paymentLogService.updatePaymentLogOnly(
                paymentLogId,
                PaymentLogStatusEnum.SUCCESS.name(),
                PaymentStatusEnum.PAID.name(),
                JsonUtil.toJson(paymentSpecificData));

        feeLedgerAllocationService.allocatePaymentForNewLog(
                paymentLogId, BigDecimal.valueOf(req.getAmount()), userPlanId);

        if (req.isGenerateInvoice()) {
            try {
                PaymentLog persistedLog = paymentLogRepository.findById(paymentLogId)
                        .orElseThrow(() -> new VacademyException("Payment log not found: " + paymentLogId));
                // institute_id is carried on each SFP — pick any row's institute_id, since
                // all installments on this plan share an institute.
                String instituteId = studentFeePaymentRepository.findByUserPlanId(userPlanId).stream()
                        .map(StudentFeePayment::getInstituteId)
                        .filter(s -> s != null && !s.isBlank())
                        .findFirst().orElse(null);
                if (instituteId != null) {
                    invoiceService.generateInvoice(plan, persistedLog, instituteId);
                } else {
                    log.warn("Skipping invoice generation for userPlan={} paymentLog={}: institute_id not resolvable",
                            userPlanId, paymentLogId);
                }
            } catch (Exception e) {
                log.warn("Failed to generate invoice for side-view offline payment userPlan={}, paymentLogId={}: {}",
                        userPlanId, paymentLogId, e.getMessage());
            }
        }

        return list(userPlanId);
    }

    // ---------------------------------------------------------------- helpers

    private UserPlanDiscountJson parseSnapshot(UserPlan plan) {
        return PaymentOptionJsonDiscountAccessor.read(plan.getPaymentOptionJson());
    }

    private static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }
}
