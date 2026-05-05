package vacademy.io.admin_core_service.features.fee_management.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;
import vacademy.io.admin_core_service.features.fee_management.repository.ComplexPaymentOptionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

/**
 * Shared CPO-validation guard used by both the school-admission flow
 * (SchoolEnrollService) and the unified strategy (ComplexPaymentOptionOperation).
 * Extracted from SchoolEnrollService.validateCpoForPackageSession so both paths
 * raise identical errors.
 */
@Service
@Slf4j
public class CpoValidationService {

    @Autowired
    private PackageSessionLearnerInvitationToPaymentOptionRepository bridgeRepository;

    @Autowired
    private ComplexPaymentOptionRepository complexPaymentOptionRepository;

    /**
     * Asserts that the CPO is ACTIVE (not PENDING_APPROVAL or DELETED) and that it is
     * linked to the given package session via an active bridge row whose paymentOption
     * has type='CPO' and complex_payment_option_id={cpoId}.
     */
    public ComplexPaymentOption validateCpoForPackageSession(String packageSessionId, String cpoId) {
        List<String> validCpoIds = bridgeRepository.findDistinctCpoIdsByPackageSessionId(packageSessionId);

        if (!validCpoIds.contains(cpoId)) {
            log.error("Invalid CPO validation failed. CPO: {} not found in valid options {} for package session: {}",
                    cpoId, validCpoIds, packageSessionId);
            throw new VacademyException(String.format(
                    "Invalid fee structure (CPO: %s) for the selected class. "
                            + "Please select a valid fee structure from the available options.",
                    cpoId));
        }

        ComplexPaymentOption cpo = complexPaymentOptionRepository.findById(cpoId)
                .orElseThrow(() -> new VacademyException("Fee structure not found: " + cpoId));

        if ("PENDING_APPROVAL".equalsIgnoreCase(cpo.getStatus())) {
            log.error("Enrollment blocked: CPO {} is still pending approval.", cpoId);
            throw new VacademyException(
                    "This fee structure is pending approval and cannot be used for enrollment. "
                            + "Please ask an admin to approve it first.");
        }

        if ("DELETED".equalsIgnoreCase(cpo.getStatus())) {
            log.error("Enrollment blocked: CPO {} is deleted.", cpoId);
            throw new VacademyException("This fee structure is no longer available.");
        }

        log.info("CPO validation successful. CPO: {} is ACTIVE and valid for package session: {}", cpoId,
                packageSessionId);
        return cpo;
    }
}
