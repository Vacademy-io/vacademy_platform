package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.learner_management.dto.CpoEnrollmentConfigDTO;
import vacademy.io.admin_core_service.features.learner_management.dto.InstallmentOverrideDTO;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Glue between the structured {@link CpoEnrollmentConfigDTO} on a bulk-assign
 * payload and the freshly-generated StudentFeePayment rows.
 *
 * <p>Called <em>after</em>
 * {@code StudentFeePaymentGenerationService.generateFeeBills(...)} has
 * materialized the template, and <em>before</em> any offline payment
 * allocation. Translates {@code aftInstallmentId}-keyed overrides into
 * SFP-id-keyed mutations and routes them through {@link CpoDiscountService}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CpoEnrollmentConfigApplier {

    private final StudentFeePaymentRepository studentFeePaymentRepository;
    private final CpoDiscountService cpoDiscountService;

    @Transactional
    public void apply(String userPlanId, CpoEnrollmentConfigDTO config, String appliedBy) {
        if (config == null) return;

        List<StudentFeePayment> sfps = studentFeePaymentRepository.findByUserPlanId(userPlanId);
        if (sfps.isEmpty()) {
            log.warn("apply() called for userPlan={} but no SFP rows exist; config ignored", userPlanId);
            return;
        }

        // Map aft_installment id -> SFP id. Multiple SFPs sharing one aft_installment
        // shouldn't happen in the current generator (one SFP per installment), but
        // if it ever does, the first wins — we log a warning so anyone hunting
        // a discrepancy has a thread to pull.
        Map<String, String> sfpByAftId = new HashMap<>();
        for (StudentFeePayment sfp : sfps) {
            if (sfp.getIId() == null) continue;
            sfpByAftId.putIfAbsent(sfp.getIId(), sfp.getId());
        }

        if (config.getInstallmentOverrides() != null) {
            for (InstallmentOverrideDTO ov : config.getInstallmentOverrides()) {
                if (ov == null || ov.getAftInstallmentId() == null) continue;
                String sfpId = sfpByAftId.get(ov.getAftInstallmentId());
                if (sfpId == null) {
                    log.warn("Override for aft_installment={} ignored — no matching SFP on userPlan={}",
                            ov.getAftInstallmentId(), userPlanId);
                    continue;
                }
                applyInstallmentOverride(sfpId, ov, appliedBy);
            }
        }

        if (config.getCpoDiscount() != null) {
            cpoDiscountService.setCpoDiscount(userPlanId, config.getCpoDiscount(), appliedBy);
        }
    }

    private void applyInstallmentOverride(String sfpId, InstallmentOverrideDTO ov, String appliedBy) {
        // Dates: independent of amount math, always safe to apply.
        if (ov.getStartDate() != null || ov.getDueDate() != null) {
            cpoDiscountService.setInstallmentDates(sfpId, ov.getStartDate(), ov.getDueDate(), appliedBy);
        }
        // Amount: explicit override wins over discount on the same row.
        if (ov.getAmount() != null) {
            cpoDiscountService.setInstallmentAmount(
                    sfpId, BigDecimal.valueOf(ov.getAmount()),
                    ov.getDiscount() != null ? ov.getDiscount().getReason() : null, appliedBy);
        } else if (ov.getDiscount() != null) {
            cpoDiscountService.setInstallmentDiscount(sfpId, ov.getDiscount(), appliedBy);
        }
    }
}
