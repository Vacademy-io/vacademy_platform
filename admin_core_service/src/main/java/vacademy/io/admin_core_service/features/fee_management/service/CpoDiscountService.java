package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.DiscountSpecDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDiscountJson;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.util.PaymentOptionJsonDiscountAccessor;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Owns the math + persistence for CPO discounts and per-installment overrides.
 *
 * <p>Two layers of state:
 * <ul>
 *   <li>{@code user_plan.discount_json} — the audit/intent snapshot
 *       (whole-CPO discount, per-installment discounts, manual amount
 *       overrides, history).</li>
 *   <li>{@code student_fee_payment.amount_expected} — the net amount FIFO
 *       targets, recomputed every time the snapshot changes.</li>
 * </ul>
 *
 * <p>The single source of truth for "how much is this installment" is
 * {@code amount_expected}. The snapshot is the source of truth for "why."
 *
 * <p>Recompute pipeline applied to each SFP whenever the snapshot changes:
 * <ol>
 *   <li>Start from {@code original_amount}.</li>
 *   <li>Subtract installment-level discount (percentage of original, or flat).</li>
 *   <li>If a manual amount override exists, replace the in-flight value
 *       with the override (this supersedes the installment discount).</li>
 *   <li>Subtract this row's share of the CPO-level discount. Share is
 *       proportional to the row's post-step-3 value over the sum across
 *       all SFPs in the plan.</li>
 *   <li>Clamp at 0. Recompute status from amount_paid vs new amount_expected.</li>
 * </ol>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CpoDiscountService {

    private final UserPlanRepository userPlanRepository;
    private final StudentFeePaymentRepository studentFeePaymentRepository;

    private static final int SCALE = 2;
    private static final RoundingMode RM = RoundingMode.HALF_UP;

    // ------------------------------------------------------------------ apply

    @Transactional
    public UserPlanDiscountJson setCpoDiscount(String userPlanId, DiscountSpecDTO spec, String appliedBy) {
        UserPlan plan = loadPlan(userPlanId);
        UserPlanDiscountJson snapshot = readOrInit(plan);

        if (spec == null) {
            UserPlanDiscountJson.DiscountEntry before = snapshot.getCpoDiscount();
            snapshot.setCpoDiscount(null);
            recordHistory(snapshot, "REMOVE", "CPO", null, before, null, appliedBy);
        } else {
            validateSpec(spec);
            UserPlanDiscountJson.DiscountEntry before = snapshot.getCpoDiscount();
            UserPlanDiscountJson.DiscountEntry entry = UserPlanDiscountJson.DiscountEntry.builder()
                    .type(spec.getType())
                    .value(spec.getValue())
                    .reason(spec.getReason())
                    .appliedBy(appliedBy)
                    .appliedAt(LocalDateTime.now())
                    .build();
            snapshot.setCpoDiscount(entry);
            recordHistory(snapshot, before == null ? "APPLY" : "MODIFY", "CPO", null, before, entry, appliedBy);
        }

        recomputeAndPersist(plan, snapshot);
        return snapshot;
    }

    @Transactional
    public UserPlanDiscountJson setInstallmentDiscount(String sfpId, DiscountSpecDTO spec, String appliedBy) {
        StudentFeePayment sfp = loadSfp(sfpId);
        UserPlan plan = loadPlan(sfp.getUserPlanId());
        UserPlanDiscountJson snapshot = readOrInit(plan);

        Map<String, UserPlanDiscountJson.InstallmentDiscountEntry> map = snapshot.getInstallmentDiscounts();
        if (map == null) {
            map = new LinkedHashMap<>();
            snapshot.setInstallmentDiscounts(map);
        }

        if (spec == null) {
            UserPlanDiscountJson.InstallmentDiscountEntry before = map.remove(sfpId);
            recordHistory(snapshot, "REMOVE", "INSTALLMENT", sfpId, before, null, appliedBy);
        } else {
            validateSpec(spec);
            UserPlanDiscountJson.InstallmentDiscountEntry before = map.get(sfpId);
            UserPlanDiscountJson.InstallmentDiscountEntry entry = UserPlanDiscountJson.InstallmentDiscountEntry.builder()
                    .aftInstallmentId(sfp.getIId())
                    .type(spec.getType())
                    .value(spec.getValue())
                    .reason(spec.getReason())
                    .appliedBy(appliedBy)
                    .appliedAt(LocalDateTime.now())
                    .build();
            map.put(sfpId, entry);
            recordHistory(snapshot, before == null ? "APPLY" : "MODIFY", "INSTALLMENT", sfpId, before, entry, appliedBy);
        }

        recomputeAndPersist(plan, snapshot);
        return snapshot;
    }

    @Transactional
    public UserPlanDiscountJson setInstallmentAmount(String sfpId, BigDecimal newAmount, String reason, String appliedBy) {
        if (newAmount == null || newAmount.signum() < 0) {
            throw new VacademyException("Installment amount must be zero or positive");
        }
        StudentFeePayment sfp = loadSfp(sfpId);
        UserPlan plan = loadPlan(sfp.getUserPlanId());
        UserPlanDiscountJson snapshot = readOrInit(plan);

        Map<String, UserPlanDiscountJson.ManualAmountOverrideEntry> map = snapshot.getManualAmountOverrides();
        if (map == null) {
            map = new LinkedHashMap<>();
            snapshot.setManualAmountOverrides(map);
        }

        UserPlanDiscountJson.ManualAmountOverrideEntry before = map.get(sfpId);
        UserPlanDiscountJson.ManualAmountOverrideEntry entry = UserPlanDiscountJson.ManualAmountOverrideEntry.builder()
                .previousAmount(sfp.getOriginalAmount())
                .newAmount(scale(newAmount))
                .reason(reason)
                .appliedBy(appliedBy)
                .appliedAt(LocalDateTime.now())
                .build();
        map.put(sfpId, entry);
        recordHistory(snapshot, "AMOUNT_OVERRIDE", "INSTALLMENT", sfpId, before, entry, appliedBy);

        recomputeAndPersist(plan, snapshot);
        return snapshot;
    }

    @Transactional
    public UserPlanDiscountJson clearInstallmentAmountOverride(String sfpId, String appliedBy) {
        StudentFeePayment sfp = loadSfp(sfpId);
        UserPlan plan = loadPlan(sfp.getUserPlanId());
        UserPlanDiscountJson snapshot = readOrInit(plan);

        Map<String, UserPlanDiscountJson.ManualAmountOverrideEntry> map = snapshot.getManualAmountOverrides();
        if (map != null && map.containsKey(sfpId)) {
            UserPlanDiscountJson.ManualAmountOverrideEntry before = map.remove(sfpId);
            recordHistory(snapshot, "REMOVE", "INSTALLMENT", sfpId, before, null, appliedBy);
        }

        recomputeAndPersist(plan, snapshot);
        return snapshot;
    }

    /**
     * Set per-learner installment dates. Persists directly to the SFP row;
     * the snapshot only records the action for audit. Does not trigger
     * amount recompute.
     */
    @Transactional
    public void setInstallmentDates(String sfpId, LocalDate startDate, LocalDate dueDate, String appliedBy) {
        StudentFeePayment sfp = loadSfp(sfpId);
        UserPlan plan = loadPlan(sfp.getUserPlanId());
        UserPlanDiscountJson snapshot = readOrInit(plan);

        Map<String, Object> before = new LinkedHashMap<>();
        before.put("startDate", sfp.getStartDate());
        before.put("dueDate", sfp.getDueDate());

        if (startDate != null) sfp.setStartDate(Date.valueOf(startDate));
        if (dueDate != null) sfp.setDueDate(Date.valueOf(dueDate));
        studentFeePaymentRepository.save(sfp);

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("startDate", sfp.getStartDate());
        after.put("dueDate", sfp.getDueDate());
        recordHistory(snapshot, "DATE_OVERRIDE", "INSTALLMENT", sfpId, before, after, appliedBy);
        persistSnapshot(plan, snapshot);
    }

    // -------------------------------------------------------------- recompute

    /**
     * Public entry point used after enrollment-time overrides write the snapshot
     * but before any side-view edits. Recomputes amount_expected + status for
     * every SFP on this plan from the snapshot.
     */
    @Transactional
    public void recomputeUserPlan(String userPlanId) {
        UserPlan plan = loadPlan(userPlanId);
        UserPlanDiscountJson snapshot = readOrInit(plan);
        recomputeAndPersist(plan, snapshot);
    }

    private void recomputeAndPersist(UserPlan plan, UserPlanDiscountJson snapshot) {
        List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserPlanId(plan.getId());
        if (sfps.isEmpty()) {
            persistSnapshot(plan, snapshot);
            return;
        }

        Map<String, BigDecimal> postStep3 = new LinkedHashMap<>();
        BigDecimal totalPostStep3 = BigDecimal.ZERO;

        for (StudentFeePayment sfp : sfps) {
            // Defensive: original_amount should always be set (V238 backfill +
            // @PrePersist), but if a row somehow has it null, fall back to
            // amount_expected so we never zero out a real bill.
            BigDecimal base = sfp.getOriginalAmount() != null
                    ? sfp.getOriginalAmount()
                    : nz(sfp.getAmountExpected());

            // Step 2: installment-level discount
            BigDecimal afterInstDiscount = base.subtract(
                    installmentDiscountAmount(base, snapshot, sfp.getId()));
            if (afterInstDiscount.signum() < 0) afterInstDiscount = BigDecimal.ZERO;

            // Step 3: manual amount override (replaces)
            BigDecimal afterOverride = manualOverrideAmount(snapshot, sfp.getId());
            if (afterOverride == null) afterOverride = afterInstDiscount;

            postStep3.put(sfp.getId(), afterOverride);
            totalPostStep3 = totalPostStep3.add(afterOverride);
        }

        BigDecimal cpoResolved = resolveCpoDiscount(snapshot, totalPostStep3);
        BigDecimal allocated = BigDecimal.ZERO;
        int idx = 0;
        int last = sfps.size() - 1;

        for (StudentFeePayment sfp : sfps) {
            BigDecimal step3Amount = postStep3.get(sfp.getId());
            BigDecimal cpoShare;
            if (totalPostStep3.signum() == 0 || cpoResolved.signum() == 0) {
                cpoShare = BigDecimal.ZERO;
            } else if (idx == last) {
                // Last row absorbs rounding drift so SUM(cpoShare) == cpoResolved exactly.
                cpoShare = cpoResolved.subtract(allocated);
            } else {
                cpoShare = step3Amount
                        .multiply(cpoResolved)
                        .divide(totalPostStep3, SCALE, RM);
                allocated = allocated.add(cpoShare);
            }

            BigDecimal net = step3Amount.subtract(cpoShare);
            if (net.signum() < 0) net = BigDecimal.ZERO;
            net = scale(net);

            sfp.setAmountExpected(net);
            sfp.setStatus(recomputeStatus(sfp.getStatus(), nz(sfp.getAmountPaid()), net));
            studentFeePaymentRepository.save(sfp);

            // Write CPO share for audit if material
            if (snapshot.getCpoDiscount() != null) {
                snapshot.getCpoDiscount().setResolvedAmount(cpoResolved);
            }
            idx++;
        }

        // For each installment discount/manual override, populate resolvedAmount for the side-view.
        annotateResolvedAmounts(snapshot, sfps);

        persistSnapshot(plan, snapshot);
    }

    // ---------------------------------------------------------------- helpers

    private BigDecimal installmentDiscountAmount(BigDecimal base, UserPlanDiscountJson snapshot, String sfpId) {
        if (snapshot.getInstallmentDiscounts() == null) return BigDecimal.ZERO;
        UserPlanDiscountJson.InstallmentDiscountEntry entry = snapshot.getInstallmentDiscounts().get(sfpId);
        if (entry == null || entry.getType() == null || entry.getValue() == null) return BigDecimal.ZERO;
        BigDecimal value = BigDecimal.valueOf(entry.getValue());
        if (DiscountSpecDTO.TYPE_PERCENTAGE.equalsIgnoreCase(entry.getType())) {
            return base.multiply(value).divide(BigDecimal.valueOf(100), SCALE, RM);
        }
        return scale(value);
    }

    private BigDecimal manualOverrideAmount(UserPlanDiscountJson snapshot, String sfpId) {
        if (snapshot.getManualAmountOverrides() == null) return null;
        UserPlanDiscountJson.ManualAmountOverrideEntry entry = snapshot.getManualAmountOverrides().get(sfpId);
        return entry == null ? null : entry.getNewAmount();
    }

    private BigDecimal resolveCpoDiscount(UserPlanDiscountJson snapshot, BigDecimal totalPostStep3) {
        if (snapshot.getCpoDiscount() == null) return BigDecimal.ZERO;
        UserPlanDiscountJson.DiscountEntry e = snapshot.getCpoDiscount();
        if (e.getType() == null || e.getValue() == null) return BigDecimal.ZERO;
        BigDecimal value = BigDecimal.valueOf(e.getValue());
        BigDecimal resolved;
        if (DiscountSpecDTO.TYPE_PERCENTAGE.equalsIgnoreCase(e.getType())) {
            resolved = totalPostStep3.multiply(value).divide(BigDecimal.valueOf(100), SCALE, RM);
        } else {
            resolved = scale(value);
        }
        if (resolved.compareTo(totalPostStep3) > 0) resolved = totalPostStep3;
        return resolved;
    }

    private void annotateResolvedAmounts(UserPlanDiscountJson snapshot, List<StudentFeePayment> sfps) {
        if (snapshot.getInstallmentDiscounts() == null) return;
        Map<String, BigDecimal> byId = new LinkedHashMap<>();
        for (StudentFeePayment sfp : sfps) byId.put(sfp.getId(), nz(sfp.getOriginalAmount()));
        for (Map.Entry<String, UserPlanDiscountJson.InstallmentDiscountEntry> e : snapshot.getInstallmentDiscounts().entrySet()) {
            BigDecimal base = byId.getOrDefault(e.getKey(), BigDecimal.ZERO);
            e.getValue().setResolvedAmount(installmentDiscountAmount(base, snapshot, e.getKey()));
        }
    }

    /**
     * Recomputes payment-state status from amount_paid vs new amount_expected.
     * Preserves WAIVED and OVERDUE since they're set by other subsystems
     * (waiver workflow / scheduled overdue job) on their own schedules.
     */
    private String recomputeStatus(String currentStatus, BigDecimal paid, BigDecimal expected) {
        if ("WAIVED".equals(currentStatus) || "OVERDUE".equals(currentStatus)) {
            return currentStatus;
        }
        if (expected.signum() == 0) return "PAID";
        if (paid.signum() == 0) return "PENDING";
        if (paid.compareTo(expected) >= 0) return "PAID";
        return "PARTIAL_PAID";
    }

    private void validateSpec(DiscountSpecDTO spec) {
        if (spec.getType() == null) throw new VacademyException("Discount type is required");
        if (!DiscountSpecDTO.TYPE_PERCENTAGE.equalsIgnoreCase(spec.getType())
                && !DiscountSpecDTO.TYPE_FLAT.equalsIgnoreCase(spec.getType())) {
            throw new VacademyException("Discount type must be PERCENTAGE or FLAT");
        }
        if (spec.getValue() == null || spec.getValue() < 0) {
            throw new VacademyException("Discount value must be zero or positive");
        }
        if (DiscountSpecDTO.TYPE_PERCENTAGE.equalsIgnoreCase(spec.getType()) && spec.getValue() > 100) {
            throw new VacademyException("Percentage discount must be between 0 and 100");
        }
    }

    private UserPlanDiscountJson readOrInit(UserPlan plan) {
        UserPlanDiscountJson parsed = PaymentOptionJsonDiscountAccessor.read(plan.getPaymentOptionJson());
        if (parsed.getInstallmentDiscounts() == null) parsed.setInstallmentDiscounts(new LinkedHashMap<>());
        if (parsed.getManualAmountOverrides() == null) parsed.setManualAmountOverrides(new LinkedHashMap<>());
        if (parsed.getHistory() == null) parsed.setHistory(new ArrayList<>());
        return parsed;
    }

    private void persistSnapshot(UserPlan plan, UserPlanDiscountJson snapshot) {
        plan.setPaymentOptionJson(
                PaymentOptionJsonDiscountAccessor.write(plan.getPaymentOptionJson(), snapshot));
        userPlanRepository.save(plan);
    }

    private void recordHistory(UserPlanDiscountJson snapshot, String action, String scope,
                               String targetId, Object before, Object after, String by) {
        snapshot.getHistory().add(UserPlanDiscountJson.HistoryEntry.builder()
                .action(action).scope(scope).targetId(targetId)
                .before(before).after(after)
                .by(by).at(LocalDateTime.now())
                .build());
    }

    private UserPlan loadPlan(String userPlanId) {
        return userPlanRepository.findById(userPlanId)
                .orElseThrow(() -> new VacademyException("UserPlan not found: " + userPlanId));
    }

    private StudentFeePayment loadSfp(String sfpId) {
        return studentFeePaymentRepository.findById(sfpId)
                .orElseThrow(() -> new VacademyException("StudentFeePayment not found: " + sfpId));
    }

    private static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }
    private static BigDecimal scale(BigDecimal b) { return b.setScale(SCALE, RM); }
}
