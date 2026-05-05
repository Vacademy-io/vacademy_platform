package vacademy.io.admin_core_service.features.user_subscription.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.repository.AftInstallmentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionFilterDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionTag;
import vacademy.io.admin_core_service.features.user_subscription.enums.PaymentOptionType;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentOptionRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentPlanRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class PaymentOptionService {

    /**
     * Default exclusion: CPO mirrors are hidden from the generic /payment-options
     * listing. Callers that explicitly want CPOs pass {@code excludeTypes=[]} or
     * {@code types=['CPO']}.
     */
    private static final List<String> DEFAULT_EXCLUDE_TYPES = List.of(PaymentOptionType.CPO.name());

    @Autowired
    private PaymentOptionRepository paymentOptionRepository;

    @Autowired
    private PaymentPlanService paymentPlanService;

    @Autowired
    private PaymentPlanRepository paymentPlanRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private AftInstallmentRepository aftInstallmentRepository;

    public boolean savePaymentOption(PaymentOptionDTO paymentOptionDTO) {
        PaymentOption paymentOption = new PaymentOption(paymentOptionDTO);

        if (PaymentOptionType.FREE.name().equalsIgnoreCase(paymentOption.getType()) && paymentOption.getPaymentPlans().isEmpty()) {
            PaymentPlan freePlan = new PaymentPlan();
            freePlan.setName("Free Plan");
            freePlan.setStatus(StatusEnum.ACTIVE.name());
            freePlan.setPaymentOption(paymentOption);
            freePlan.setActualPrice(0.0);
            freePlan.setElevatedPrice(0.0);
            freePlan.setCurrency("INR");
            paymentOption.getPaymentPlans().add(freePlan);
        }

        paymentOptionRepository.save(paymentOption);
        return true;
    }

    public List<PaymentOptionDTO> getPaymentOptions(PaymentOptionFilterDTO paymentOptionFilterDTO, CustomUserDetails userDetails) {
        List<String> excludeTypes = resolveExcludeTypes(paymentOptionFilterDTO);

        List<PaymentOption> paymentOptions = paymentOptionRepository.findPaymentOptionsWithPaymentPlansNative(
                paymentOptionFilterDTO.getTypes(),
                excludeTypes,
                paymentOptionFilterDTO.getSource(),
                paymentOptionFilterDTO.getSourceId(),
                List.of(StatusEnum.ACTIVE.name()),
                List.of(StatusEnum.ACTIVE.name()),
                paymentOptionFilterDTO.isRequireApproval(),
                paymentOptionFilterDTO.isNotRequireApproval()
        );
        return paymentOptions.stream().map(PaymentOption::mapToPaymentOptionDTO).toList();
    }

    public Optional<PaymentOption> getPaymentOption(String source, String sourceId, String tag, List<String> statuses) {
        return paymentOptionRepository.findTopByFiltersWithPlans(source, sourceId, tag, DEFAULT_EXCLUDE_TYPES, statuses, statuses);
    }

    private void changeDefaultPaymentOption(String source, String sourceId) {
        Optional<PaymentOption> optionalPaymentOption = getPaymentOption(source, sourceId, PaymentOptionTag.DEFAULT.name(), List.of(StatusEnum.ACTIVE.name()));
        if (optionalPaymentOption.isPresent()) {
            PaymentOption paymentOption = optionalPaymentOption.get();
            paymentOption.setTag(null);
            paymentOptionRepository.save(paymentOption);
        }
    }

    private void makeDefaultPaymentOption(String paymentOptionId) {
        PaymentOption paymentOption = findById(paymentOptionId);
        paymentOption.setTag(PaymentOptionTag.DEFAULT.name());
        paymentOptionRepository.save(paymentOption);
    }

    public String makeDefaultPaymentOption(String paymentOptionId, String source, String sourceId) {
        changeDefaultPaymentOption(source, sourceId);
        makeDefaultPaymentOption(paymentOptionId);
        return "success";
    }

    public PaymentOption findById(String id) {
        return paymentOptionRepository.findById(id).orElseThrow(() -> new VacademyException("Payment Option not found"));
    }

    public Optional<PaymentOption> findByComplexPaymentOptionId(String complexPaymentOptionId) {
        if (complexPaymentOptionId == null) return Optional.empty();
        return paymentOptionRepository.findByComplexPaymentOptionId(complexPaymentOptionId);
    }

    public String deletePaymentOption(List<String> paymentOptionIds, CustomUserDetails userDetails) {
        List<PaymentOption> paymentOptions = paymentOptionRepository.findAllById(paymentOptionIds);
        for (PaymentOption paymentOption : paymentOptions) {
            paymentOption.setStatus(StatusEnum.DELETED.name());
        }
        paymentOptionRepository.saveAll(paymentOptions);
        return "success";
    }

    public PaymentOptionDTO editPaymentOption(PaymentOptionDTO paymentOptionDTO) {
        PaymentOption paymentOption = findById(paymentOptionDTO.getId());
        paymentOption.setName(paymentOptionDTO.getName());
        paymentOption.setType(paymentOptionDTO.getType());
        paymentOption.setPaymentOptionMetadataJson(paymentOptionDTO.getPaymentOptionMetadataJson());
        paymentOption.setRequireApproval(paymentOptionDTO.isRequireApproval());
        paymentOption.setUnit(paymentOptionDTO.getUnit());
        List<PaymentPlan> paymentPlans = paymentPlanService.editPaymentPlans(paymentOption.getPaymentPlans(), paymentOptionDTO.getPaymentPlans(), paymentOption);
        paymentOption.setPaymentPlans(paymentPlans);
        paymentOptionRepository.save(paymentOption);
        return paymentOption.mapToPaymentOptionDTO();
    }

    // -------------------------------------------------------------------------
    // CPO mirror sync
    // -------------------------------------------------------------------------

    /**
     * Returns the existing mirror PaymentOption for the given CPO, or creates one
     * (plus a synthetic PaymentPlan) if it does not exist yet. Idempotent.
     * Called from FeeManagementService after every CPO create/update.
     */
    public PaymentOption findOrCreateMirrorForCpo(ComplexPaymentOption cpo) {
        if (cpo == null || cpo.getId() == null) {
            throw new VacademyException("Cannot create mirror PaymentOption: CPO is null");
        }

        Optional<PaymentOption> existing = paymentOptionRepository.findByComplexPaymentOptionId(cpo.getId());
        if (existing.isPresent()) {
            return syncMirrorForCpo(cpo, existing.get());
        }

        PaymentOption mirror = new PaymentOption();
        mirror.setName(cpo.getName());
        mirror.setStatus(mapCpoStatusToPaymentOptionStatus(cpo.getStatus()));
        mirror.setSource("INSTITUTE");
        mirror.setSourceId(cpo.getInstituteId());
        mirror.setType(PaymentOptionType.CPO.name());
        mirror.setRequireApproval(false);
        mirror.setComplexPaymentOptionId(cpo.getId());

        PaymentOption saved = paymentOptionRepository.save(mirror);
        upsertSyntheticPaymentPlan(cpo, saved);
        log.info("Created mirror PaymentOption {} for CPO {}", saved.getId(), cpo.getId());
        return saved;
    }

    /**
     * Re-syncs the mirror PaymentOption + synthetic PaymentPlan with the current
     * state of the CPO (name, status, fee structure totals). Called after CPO
     * update/approve/soft-delete and after fee-type updates.
     */
    public PaymentOption syncMirrorForCpo(ComplexPaymentOption cpo) {
        if (cpo == null) return null;
        Optional<PaymentOption> existing = paymentOptionRepository.findByComplexPaymentOptionId(cpo.getId());
        if (existing.isEmpty()) {
            return findOrCreateMirrorForCpo(cpo);
        }
        return syncMirrorForCpo(cpo, existing.get());
    }

    private PaymentOption syncMirrorForCpo(ComplexPaymentOption cpo, PaymentOption mirror) {
        mirror.setName(cpo.getName());
        mirror.setStatus(mapCpoStatusToPaymentOptionStatus(cpo.getStatus()));
        // institute_id may have changed (rare but supported)
        mirror.setSourceId(cpo.getInstituteId());
        // type is fixed; never reset
        if (!PaymentOptionType.CPO.name().equals(mirror.getType())) {
            mirror.setType(PaymentOptionType.CPO.name());
        }
        PaymentOption saved = paymentOptionRepository.save(mirror);
        upsertSyntheticPaymentPlan(cpo, saved);
        return saved;
    }

    private void upsertSyntheticPaymentPlan(ComplexPaymentOption cpo, PaymentOption mirror) {
        BigDecimal total = computeTotalContractValue(cpo.getId());
        Integer validityDays = computeValidityInDays(cpo.getId());

        List<PaymentPlan> existingPlans = paymentPlanRepository.findByPaymentOption(mirror);
        PaymentPlan plan = existingPlans.stream()
                .filter(p -> !StatusEnum.DELETED.name().equalsIgnoreCase(p.getStatus()))
                .findFirst()
                .orElse(null);

        if (plan == null) {
            plan = new PaymentPlan();
            plan.setName(cpo.getName());
            plan.setStatus(StatusEnum.ACTIVE.name());
            plan.setCurrency("INR");
            plan.setDescription("Synthetic plan auto-generated for CPO-backed payment option");
            plan.setTag(PaymentOptionTag.DEFAULT.name());
            plan.setPaymentOption(mirror);
        } else {
            plan.setName(cpo.getName());
            plan.setStatus(StatusEnum.ACTIVE.name());
        }
        plan.setActualPrice(total != null ? total.doubleValue() : 0.0);
        plan.setElevatedPrice(0.0);
        plan.setValidityInDays(validityDays);
        paymentPlanRepository.save(plan);
    }

    /**
     * Sums all installment amounts under the CPO. Falls back to AssignedFeeValue.amount
     * for fee types that have no installments defined.
     */
    private BigDecimal computeTotalContractValue(String cpoId) {
        BigDecimal total = BigDecimal.ZERO;
        List<FeeType> feeTypes = feeTypeRepository.findByCpoId(cpoId);
        for (FeeType ft : feeTypes) {
            if (StatusEnum.DELETED.name().equalsIgnoreCase(ft.getStatus())) continue;
            List<AssignedFeeValue> afvs = assignedFeeValueRepository.findByFeeTypeId(ft.getId());
            for (AssignedFeeValue afv : afvs) {
                if (StatusEnum.DELETED.name().equalsIgnoreCase(afv.getStatus())) continue;
                List<AftInstallment> installments = aftInstallmentRepository
                        .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(afv.getId());
                if (installments.isEmpty()) {
                    if (afv.getAmount() != null) total = total.add(afv.getAmount());
                } else {
                    for (AftInstallment ai : installments) {
                        if (ai.getAmount() != null) total = total.add(ai.getAmount());
                    }
                }
            }
        }
        return total;
    }

    /**
     * Returns the duration between the earliest installment start_date and the latest
     * end_date (in days). Null when no installments carry both dates.
     */
    private Integer computeValidityInDays(String cpoId) {
        List<FeeType> feeTypes = feeTypeRepository.findByCpoId(cpoId);
        java.time.LocalDate minStart = null;
        java.time.LocalDate maxEnd = null;
        for (FeeType ft : feeTypes) {
            List<AssignedFeeValue> afvs = assignedFeeValueRepository.findByFeeTypeId(ft.getId());
            for (AssignedFeeValue afv : afvs) {
                List<AftInstallment> installments = aftInstallmentRepository
                        .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(afv.getId());
                for (AftInstallment ai : installments) {
                    if (ai.getStartDate() != null && (minStart == null || ai.getStartDate().isBefore(minStart))) {
                        minStart = ai.getStartDate();
                    }
                    if (ai.getEndDate() != null && (maxEnd == null || ai.getEndDate().isAfter(maxEnd))) {
                        maxEnd = ai.getEndDate();
                    }
                }
            }
        }
        if (minStart == null || maxEnd == null) return null;
        long days = ChronoUnit.DAYS.between(minStart, maxEnd);
        return days > 0 ? (int) days : null;
    }

    private String mapCpoStatusToPaymentOptionStatus(String cpoStatus) {
        if (cpoStatus == null) return StatusEnum.ACTIVE.name();
        if ("PENDING_APPROVAL".equalsIgnoreCase(cpoStatus)) return "PENDING_APPROVAL";
        if (StatusEnum.DELETED.name().equalsIgnoreCase(cpoStatus)) return StatusEnum.DELETED.name();
        return StatusEnum.ACTIVE.name();
    }

    private List<String> resolveExcludeTypes(PaymentOptionFilterDTO filter) {
        List<String> excludeTypes = filter.getExcludeTypes();
        if (excludeTypes == null) {
            // Caller did not specify → apply default: hide CPO mirrors from generic listing
            // (unless they explicitly asked for CPO via types=['CPO'])
            if (filter.getTypes() != null && filter.getTypes().contains(PaymentOptionType.CPO.name())) {
                return null;
            }
            return new ArrayList<>(DEFAULT_EXCLUDE_TYPES);
        }
        if (excludeTypes.isEmpty()) {
            // Caller explicitly disabled the default exclusion.
            return null;
        }
        return excludeTypes;
    }
}
