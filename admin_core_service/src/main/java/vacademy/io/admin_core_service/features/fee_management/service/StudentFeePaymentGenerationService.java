package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.fee_management.entity.AftInstallment;
import vacademy.io.admin_core_service.features.fee_management.entity.AssignedFeeValue;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.AftInstallmentRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.AssignedFeeValueRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.FeeTypeRepository;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.sql.Date;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class StudentFeePaymentGenerationService {

    @Autowired
    private FeeTypeRepository feeTypeRepository;

    @Autowired
    private AssignedFeeValueRepository assignedFeeValueRepository;

    @Autowired
    private AftInstallmentRepository aftInstallmentRepository;

    @Autowired
    private StudentFeePaymentRepository studentFeePaymentRepository;

    /**
     * Generates StudentFeePayment rows from the CPO template chain:
     * CPO -> FeeType -> AssignedFeeValue -> AftInstallment
     * 
     * Creates one StudentFeePayment per AftInstallment row.
     *
     * @param userPlanId The student's UserPlan ID
     * @param cpoId      The ComplexPaymentOption ID
     * @param userId     The student's User ID (required for DB NOT NULL constraint)
     * @return List of created StudentFeePayment IDs
     */
    @Transactional
    public List<String> generateFeeBills(String userPlanId, String cpoId, String userId) {
        log.info("Generating fee bills for UserPlan: {}, CPO: {}, User: {}", userPlanId, cpoId, userId);

        // Step 1: Fetch all FeeTypes for this CPO
        List<FeeType> feeTypes = feeTypeRepository.findByCpoId(cpoId);
        if (feeTypes.isEmpty()) {
            throw new VacademyException("No fee types found for CPO: " + cpoId);
        }

        List<String> createdPaymentIds = new ArrayList<>();

        for (FeeType feeType : feeTypes) {
            // Step 2: Fetch AssignedFeeValues for each FeeType
            List<AssignedFeeValue> assignedFeeValues = assignedFeeValueRepository.findByFeeTypeId(feeType.getId());

            for (AssignedFeeValue afv : assignedFeeValues) {
                // Step 3: Fetch AftInstallments for each AssignedFeeValue
                List<AftInstallment> installments = aftInstallmentRepository
                        .findByAssignedFeeValueIdOrderByInstallmentNumberAsc(afv.getId());

                if (installments.isEmpty()) {
                    // If no installments defined, create a single bill for the full amount
                    log.info("No installments defined for AFV: {}. Creating single bill for amount: {}",
                            afv.getId(), afv.getAmount());

                    StudentFeePayment payment = new StudentFeePayment();
                    payment.setUserId(userId);
                    payment.setUserPlanId(userPlanId);
                    payment.setCpoId(cpoId);
                    payment.setAsvId(afv.getId());
                    payment.setIId(afv.getId()); // No installment; use AFV ID as sentinel
                    payment.setAmountExpected(afv.getAmount());
                    payment.setAmountPaid(BigDecimal.ZERO);
                    payment.setStatus("PENDING");

                    StudentFeePayment saved = studentFeePaymentRepository.save(payment);
                    createdPaymentIds.add(saved.getId());
                } else {
                    // Step 4: Create one StudentFeePayment per AftInstallment
                    for (AftInstallment installment : installments) {
                        StudentFeePayment payment = new StudentFeePayment();
                        payment.setUserId(userId);
                        payment.setUserPlanId(userPlanId);
                        payment.setCpoId(cpoId);
                        payment.setAsvId(afv.getId());
                        payment.setIId(installment.getId());
                        payment.setAmountExpected(installment.getAmount());
                        payment.setAmountPaid(BigDecimal.ZERO);
                        payment.setDueDate(Date.valueOf(installment.getDueDate()));
                        payment.setStatus("PENDING");

                        StudentFeePayment saved = studentFeePaymentRepository.save(payment);
                        createdPaymentIds.add(saved.getId());

                        log.info("Created StudentFeePayment {} for installment #{}, amount: {}, due: {}",
                                saved.getId(), installment.getInstallmentNumber(),
                                installment.getAmount(), installment.getDueDate());
                    }
                }
            }
        }

        log.info("Generated {} fee bills for UserPlan: {}", createdPaymentIds.size(), userPlanId);
        return createdPaymentIds;
    }
}
