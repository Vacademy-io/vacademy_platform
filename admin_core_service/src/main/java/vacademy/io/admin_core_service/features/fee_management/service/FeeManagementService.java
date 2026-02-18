package vacademy.io.admin_core_service.features.fee_management.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.dto.ComplexPaymentOptionDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.repository.AftInstallmentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FeeManagementService {

    @Autowired
    private ComplexPaymentOptionRepository cpoRepository;

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private AftInstallmentRepository aftInstallmentRepository;

    /**
     * API #1: Create a full CPO with nested fee types, assigned values, and
     * installments.
     */
    @Transactional
    public ComplexPaymentOptionDTO createCpo(ComplexPaymentOptionDTO request) {
        // 1. Save CPO first
        ComplexPaymentOption cpo = new ComplexPaymentOption();
        cpo.setName(request.getName());
        cpo.setInstituteId(request.getInstituteId());
        cpo.setDefaultPaymentOptionId(request.getDefaultPaymentOptionId());
        cpo.setStatus(request.getStatus() != null ? request.getStatus() : "ACTIVE");
        ComplexPaymentOption savedCpo = cpoRepository.save(cpo);

        if (request.getFeeTypes() != null) {
            for (ComplexPaymentOptionDTO.FeeTypeDTO ftDTO : request.getFeeTypes()) {
                // 2. Save each FeeType with cpoId
                FeeType feeType = new FeeType();
                feeType.setName(ftDTO.getName());
                feeType.setCode(ftDTO.getCode());
                feeType.setDescription(ftDTO.getDescription());
                feeType.setStatus(ftDTO.getStatus() != null ? ftDTO.getStatus() : "ACTIVE");
                feeType.setCpoId(savedCpo.getId());
                FeeType savedFeeType = feeTypeRepository.save(feeType);

                if (ftDTO.getAssignedFeeValue() != null) {
                    ComplexPaymentOptionDTO.AssignedFeeValueDTO afvDTO = ftDTO.getAssignedFeeValue();
                    // 3. Save AssignedFeeValue with feeTypeId
                    AssignedFeeValue afv = new AssignedFeeValue();
                    afv.setAmount(afvDTO.getAmount());
                    afv.setNoOfInstallments(afvDTO.getNoOfInstallments() != null ? afvDTO.getNoOfInstallments() : 1);
                    afv.setHasInstallment(afvDTO.getHasInstallment() != null ? afvDTO.getHasInstallment() : false);
                    afv.setIsRefundable(afvDTO.getIsRefundable() != null ? afvDTO.getIsRefundable() : false);
                    afv.setHasPenalty(afvDTO.getHasPenalty() != null ? afvDTO.getHasPenalty() : false);
                    afv.setPenaltyPercentage(afvDTO.getPenaltyPercentage());
                    afv.setStatus(afvDTO.getStatus() != null ? afvDTO.getStatus() : "ACTIVE");
                    afv.setFeeTypeId(savedFeeType.getId());
                    AssignedFeeValue savedAfv = assignedFeeValueRepository.save(afv);

                    if (afvDTO.getInstallments() != null) {
                        for (ComplexPaymentOptionDTO.AftInstallmentDTO instDTO : afvDTO.getInstallments()) {
                            // 4. Save each installment with assignedFeeValueId
                            AftInstallment inst = new AftInstallment();
                            inst.setInstallmentNumber(instDTO.getInstallmentNumber());
                            inst.setAmount(instDTO.getAmount());
                            inst.setDueDate(instDTO.getDueDate());
                            inst.setStatus(instDTO.getStatus() != null ? instDTO.getStatus() : "PENDING");
                            inst.setAssignedFeeValueId(savedAfv.getId());
                            aftInstallmentRepository.save(inst);
                        }
                    }
                }
            }
        }

        return getFullCpo(savedCpo.getId());
    }

    /**
     * API #2: List all CPOs for an institute (lightweight - no nested children).
     */
    public List<ComplexPaymentOptionDTO> listCposByInstitute(String instituteId) {
        List<ComplexPaymentOption> cpos = cpoRepository.findByInstituteIdAndStatus(instituteId, "ACTIVE");
        return cpos.stream()
                .map(cpo -> ComplexPaymentOptionDTO.builder()
                        .id(cpo.getId())
                        .name(cpo.getName())
                        .instituteId(cpo.getInstituteId())
                        .defaultPaymentOptionId(cpo.getDefaultPaymentOptionId())
                        .status(cpo.getStatus())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * API #3: Get full CPO with all nested children (fee types → assigned values →
     * installments).
     */
    public ComplexPaymentOptionDTO getFullCpo(String cpoId) {
        ComplexPaymentOption cpo = cpoRepository.findById(cpoId)
                .orElseThrow(() -> new VacademyException("Complex Payment Option not found: " + cpoId));

        // Fetch fee types by cpoId
        List<FeeType> feeTypes = feeTypeRepository.findByCpoId(cpo.getId());

        List<ComplexPaymentOptionDTO.FeeTypeDTO> feeTypeDTOs = new ArrayList<>();
        for (FeeType ft : feeTypes) {
            // Fetch assigned fee values by feeTypeId
            List<AssignedFeeValue> afvList = assignedFeeValueRepository.findByFeeTypeId(ft.getId());

            ComplexPaymentOptionDTO.AssignedFeeValueDTO afvDTO = null;
            if (!afvList.isEmpty()) {
                AssignedFeeValue afv = afvList.get(0); // One AFV per fee type
                // Fetch installments by assignedFeeValueId
                List<AftInstallment> installments = aftInstallmentRepository
                        .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(afv.getId());

                List<ComplexPaymentOptionDTO.AftInstallmentDTO> instDTOs = installments.stream()
                        .map(inst -> ComplexPaymentOptionDTO.AftInstallmentDTO.builder()
                                .id(inst.getId())
                                .installmentNumber(inst.getInstallmentNumber())
                                .amount(inst.getAmount())
                                .dueDate(inst.getDueDate())
                                .status(inst.getStatus())
                                .build())
                        .collect(Collectors.toList());

                afvDTO = ComplexPaymentOptionDTO.AssignedFeeValueDTO.builder()
                        .id(afv.getId())
                        .amount(afv.getAmount())
                        .noOfInstallments(afv.getNoOfInstallments())
                        .hasInstallment(afv.getHasInstallment())
                        .isRefundable(afv.getIsRefundable())
                        .hasPenalty(afv.getHasPenalty())
                        .penaltyPercentage(afv.getPenaltyPercentage())
                        .status(afv.getStatus())
                        .installments(instDTOs)
                        .build();
            }

            feeTypeDTOs.add(ComplexPaymentOptionDTO.FeeTypeDTO.builder()
                    .id(ft.getId())
                    .name(ft.getName())
                    .code(ft.getCode())
                    .description(ft.getDescription())
                    .status(ft.getStatus())
                    .assignedFeeValue(afvDTO)
                    .build());
        }

        return ComplexPaymentOptionDTO.builder()
                .id(cpo.getId())
                .name(cpo.getName())
                .instituteId(cpo.getInstituteId())
                .defaultPaymentOptionId(cpo.getDefaultPaymentOptionId())
                .status(cpo.getStatus())
                .feeTypes(feeTypeDTOs)
                .build();
    }

    /**
     * API #4: Update CPO Metadata (Name, Institute, etc.)
     */
    @Transactional
    public ComplexPaymentOptionDTO updateCpo(String cpoId, ComplexPaymentOptionDTO request) {
        ComplexPaymentOption cpo = cpoRepository.findById(cpoId)
                .orElseThrow(() -> new VacademyException("Complex Payment Option not found: " + cpoId));

        if (request.getName() != null)
            cpo.setName(request.getName());
        if (request.getInstituteId() != null)
            cpo.setInstituteId(request.getInstituteId());
        if (request.getDefaultPaymentOptionId() != null)
            cpo.setDefaultPaymentOptionId(request.getDefaultPaymentOptionId());
        if (request.getStatus() != null)
            cpo.setStatus(request.getStatus());

        cpoRepository.save(cpo);
        return getFullCpo(cpoId);
    }

    /**
     * API #5: Update Fee Type & Commercials (Cascade Update)
     */
    @Transactional
    public ComplexPaymentOptionDTO.FeeTypeDTO updateFeeType(String feeTypeId,
            ComplexPaymentOptionDTO.FeeTypeDTO request) {
        // 1. Update FeeType
        FeeType feeType = feeTypeRepository.findById(feeTypeId)
                .orElseThrow(() -> new VacademyException("Fee Type not found: " + feeTypeId));

        if (request.getName() != null)
            feeType.setName(request.getName());
        if (request.getCode() != null)
            feeType.setCode(request.getCode());
        if (request.getDescription() != null)
            feeType.setDescription(request.getDescription());
        if (request.getStatus() != null)
            feeType.setStatus(request.getStatus());
        feeTypeRepository.save(feeType);

        // 2. Update AssignedFeeValue
        if (request.getAssignedFeeValue() != null) {
            ComplexPaymentOptionDTO.AssignedFeeValueDTO afvDTO = request.getAssignedFeeValue();

            // Check if exists, else create (though usually should exist for an update)
            List<AssignedFeeValue> existingAfvs = assignedFeeValueRepository.findByFeeTypeId(feeTypeId);
            AssignedFeeValue afv;

            if (existingAfvs.isEmpty()) {
                afv = new AssignedFeeValue();
                afv.setFeeTypeId(feeTypeId);
                afv.setStatus("ACTIVE");
            } else {
                afv = existingAfvs.get(0);
            }

            if (afvDTO.getAmount() != null)
                afv.setAmount(afvDTO.getAmount());
            if (afvDTO.getNoOfInstallments() != null)
                afv.setNoOfInstallments(afvDTO.getNoOfInstallments());
            if (afvDTO.getHasInstallment() != null)
                afv.setHasInstallment(afvDTO.getHasInstallment());
            if (afvDTO.getIsRefundable() != null)
                afv.setIsRefundable(afvDTO.getIsRefundable());
            if (afvDTO.getHasPenalty() != null)
                afv.setHasPenalty(afvDTO.getHasPenalty());
            if (afvDTO.getPenaltyPercentage() != null)
                afv.setPenaltyPercentage(afvDTO.getPenaltyPercentage());
            if (afvDTO.getStatus() != null)
                afv.setStatus(afvDTO.getStatus());

            AssignedFeeValue savedAfv = assignedFeeValueRepository.save(afv);

            // 3. Update Installments (Delete & Recreate)
            if (afvDTO.getInstallments() != null) {
                // Delete existing
                List<AftInstallment> existingInstallments = aftInstallmentRepository
                        .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(savedAfv.getId());
                aftInstallmentRepository.deleteAll(existingInstallments);

                // Create new
                for (ComplexPaymentOptionDTO.AftInstallmentDTO instDTO : afvDTO.getInstallments()) {
                    AftInstallment inst = new AftInstallment();
                    inst.setInstallmentNumber(instDTO.getInstallmentNumber());
                    inst.setAmount(instDTO.getAmount());
                    inst.setDueDate(instDTO.getDueDate());
                    inst.setStatus(instDTO.getStatus() != null ? instDTO.getStatus() : "PENDING");
                    inst.setAssignedFeeValueId(savedAfv.getId());
                    aftInstallmentRepository.save(inst);
                }
            }
        }

        return request;
    }
}
