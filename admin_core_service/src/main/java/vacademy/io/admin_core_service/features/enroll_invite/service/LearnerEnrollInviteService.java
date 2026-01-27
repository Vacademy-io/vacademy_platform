package vacademy.io.admin_core_service.features.enroll_invite.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.dto.EnrollInviteDTO;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.List;
import java.util.Objects;

@Service
public class LearnerEnrollInviteService {

    @Autowired
    private EnrollInviteRepository enrollInviteRepository;

    @Autowired
    private EnrollInviteService enrollInviteService;

    @Autowired
    private vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager studentRegistrationManager;

    @Autowired
    private vacademy.io.admin_core_service.features.institute_learner.service.LearnerEnrollmentEntryService learnerEnrollmentEntryService;

    @Autowired
    private vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository packageSessionRepository;

    /**
     * Fetches and validates an active enroll invite by instituteId and inviteCode.
     *
     * @param instituteId The ID of the institute.
     * @param inviteCode  The invite code used by learner.
     * @return Fully populated EnrollInviteDTO
     * @throws VacademyException if invite not found, not started yet, or expired.
     */
    public EnrollInviteDTO getEnrollInvite(String instituteId, String inviteCode) {
        if (Objects.isNull(instituteId) || Objects.isNull(inviteCode)) {
            throw new VacademyException("Institute ID and Invite Code are required.");
        }

        EnrollInvite enrollInvite = enrollInviteRepository
                .findValidEnrollInvite(List.of(StatusEnum.ACTIVE.name()), instituteId, inviteCode)
                .orElseThrow(() -> new VacademyException("Enroll invite not found."));

        Date now = new Date();

        if (enrollInvite.getStartDate() != null && enrollInvite.getStartDate().after(now)) {
            throw new VacademyException("This enroll invite has not started accepting enrollments yet.");
        }

        if (enrollInvite.getEndDate() != null && enrollInvite.getEndDate().before(now)) {
            throw new VacademyException("This enroll invite has expired.");
        }

        return enrollInviteService.buildFullEnrollInviteDTO(enrollInvite, instituteId);
    }

    @org.springframework.transaction.annotation.Transactional
    public String captureLead(vacademy.io.admin_core_service.features.enroll_invite.dto.LeadCaptureRequestDTO request) {
        // 1. Validate Request
        if (request.getInstituteId() == null || request.getUserDetails() == null
                || request.getPackageSessionIds() == null) {
            throw new VacademyException(
                    "Invalid request: InstituteId, UserDetails, and PackageSessionIds are required.");
        }

        // 2. Create/Get User
        vacademy.io.common.auth.dto.UserDTO userDTO = studentRegistrationManager
                .createUserFromAuthService(request.getUserDetails(), request.getInstituteId(), false);

        // 3. Create Student Entity
        vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails extraDetails = mapToStudentExtraDetails(
                request.getLearnerExtraDetails());
        studentRegistrationManager.createStudentFromRequest(userDTO, extraDetails);

        // 4. Create ONLY_DETAILS_FILLED Entries
        for (String actualPackageSessionId : request.getPackageSessionIds()) {
            vacademy.io.common.institute.entity.session.PackageSession invitedPackageSession = learnerEnrollmentEntryService
                    .findInvitedPackageSession(actualPackageSessionId);

            vacademy.io.common.institute.entity.session.PackageSession actualPackageSession = packageSessionRepository
                    .findById(actualPackageSessionId)
                    .orElseThrow(() -> new VacademyException("Package session not found: " + actualPackageSessionId));

            // Mark previous entries as deleted (Clean state)
            learnerEnrollmentEntryService.markPreviousEntriesAsDeleted(
                    userDTO.getId(),
                    invitedPackageSession.getId(),
                    actualPackageSessionId,
                    request.getInstituteId());

            // Create new ONLY_DETAILS_FILLED entry
            // Passing null for userPlanId as this is pre-payment/pre-plan selection
            learnerEnrollmentEntryService.createOnlyDetailsFilledEntry(
                    userDTO.getId(),
                    invitedPackageSession,
                    actualPackageSession,
                    request.getInstituteId(),
                    null);
        }

        return userDTO.getId();
    }

    private vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails mapToStudentExtraDetails(
            vacademy.io.common.auth.dto.learner.LearnerExtraDetails learnerExtraDetails) {
        if (learnerExtraDetails == null) {
            return null;
        }
        vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails studentExtraDetails = new vacademy.io.admin_core_service.features.institute_learner.dto.StudentExtraDetails();
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
