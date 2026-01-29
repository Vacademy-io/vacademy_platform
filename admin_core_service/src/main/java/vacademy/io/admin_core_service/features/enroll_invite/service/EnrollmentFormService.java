package vacademy.io.admin_core_service.features.enroll_invite.service;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.CustomFieldValueSourceTypeEnum;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollmentFormSubmitDTO;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollmentFormSubmitResponseDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class EnrollmentFormService {

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Autowired
    private StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Transactional
    public EnrollmentFormSubmitResponseDTO submitEnrollmentForm(EnrollmentFormSubmitDTO request) {
        log.info("Processing enrollment form submission for email: {}", 
                request.getUserDetails() != null ? request.getUserDetails().getEmail() : "null");

        // Step 1: Validate EnrollInvite
        validateEnrollInvite(request.getEnrollInviteId(), request.getInstituteId());

        // Step 2: Create or update user
        UserDTO createdUser = studentRegistrationManager.createUserFromAuthService(
                request.getUserDetails(), 
                request.getInstituteId(), 
                false);
        
        // Step 3: Create student record
        studentRegistrationManager.createStudentFromRequest(
                createdUser,
                mapToStudentExtraDetails(request.getLearnerExtraDetails()));

        // Step 4: Create ABANDONED_CART entries for each package session
        List<String> abandonedCartEntryIds = new ArrayList<>();
        
        for (String actualPackageSessionId : request.getPackageSessionIds()) {
            // Find INVITED PackageSession
            PackageSession invitedPackageSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(actualPackageSessionId);

            PackageSession actualPackageSession = packageSessionRepository.findById(actualPackageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found: " + actualPackageSessionId));

            // Mark previous ABANDONED_CART and PAYMENT_FAILED entries as DELETED
            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    createdUser.getId(),
                    invitedPackageSession.getId(),
                    actualPackageSessionId,
                    request.getInstituteId());

            // Create new ABANDONED_CART entry (without userPlanId - will be set later during payment)
            StudentSessionInstituteGroupMapping entry = learnerEnrollmentEntryService.createOnlyDetailsFilledEntry(
                    createdUser.getId(),
                    invitedPackageSession,
                    actualPackageSession,
                    request.getInstituteId(),
                    null); // userPlanId is null at this stage

            abandonedCartEntryIds.add(entry.getId());
            
            log.info("Created ABANDONED_CART entry {} for user {} in package session {}",
                    entry.getId(), createdUser.getId(), actualPackageSessionId);
        }

        // Step 5: Save custom field values
        if (request.getCustomFieldValues() != null && !request.getCustomFieldValues().isEmpty()) {
            customFieldValueService.addCustomFieldValue(
                    request.getCustomFieldValues(),
                    CustomFieldValueSourceTypeEnum.USER.name(),
                    createdUser.getId());
        }

        log.info("Enrollment form submitted successfully for user: {}, created {} ABANDONED_CART entries",
                createdUser.getId(), abandonedCartEntryIds.size());

        return EnrollmentFormSubmitResponseDTO.builder()
                .userId(createdUser.getId())
                .abandonedCartEntryIds(abandonedCartEntryIds)
                .message("Form submitted successfully. Please proceed to payment.")
                .build();
    }

    private EnrollInvite validateEnrollInvite(String enrollInviteId, String instituteId) {
        Optional<EnrollInvite> enrollInviteOpt = enrollInviteRepository.findById(enrollInviteId);
        
        if (enrollInviteOpt.isEmpty()) {
            throw new VacademyException("Enroll invite not found: " + enrollInviteId);
        }

        EnrollInvite enrollInvite = enrollInviteOpt.get();

        // Check if invite belongs to the institute
        if (!enrollInvite.getInstituteId().equals(instituteId)) {
            throw new VacademyException("Enroll invite does not belong to this institute");
        }

        // Check if invite is active
        if (!"ACTIVE".equals(enrollInvite.getStatus())) {
            throw new VacademyException("Enroll invite is not active");
        }

        // Check if invite has started
        Date now = new Date();
        if (enrollInvite.getStartDate() != null && enrollInvite.getStartDate().after(now)) {
            throw new VacademyException("Enroll invite has not started yet");
        }

        // Check if invite has expired
        if (enrollInvite.getEndDate() != null && enrollInvite.getEndDate().before(now)) {
            throw new VacademyException("Enroll invite has expired");
        }

        return enrollInvite;
    }

    private StudentExtraDetails mapToStudentExtraDetails(LearnerExtraDetails learnerExtraDetails) {
        if (learnerExtraDetails == null) {
            return null;
        }
        StudentExtraDetails studentExtraDetails = new StudentExtraDetails();
        studentExtraDetails.setFathersName(learnerExtraDetails.getFathersName());
        studentExtraDetails.setMothersName(learnerExtraDetails.getMothersName());
        studentExtraDetails.setParentsMobileNumber(learnerExtraDetails.getParentsMobileNumber());
        studentExtraDetails.setParentsEmail(learnerExtraDetails.getParentsEmail());
        studentExtraDetails.setParentsToMotherMobileNumber(learnerExtraDetails.getParentsToMotherMobileNumber());
        studentExtraDetails.setParentsToMotherEmail(learnerExtraDetails.getParentsToMotherEmail());
        studentExtraDetails.setLinkedInstituteName(learnerExtraDetails.getLinkedInstituteName());
        return studentExtraDetails;
    }
}
