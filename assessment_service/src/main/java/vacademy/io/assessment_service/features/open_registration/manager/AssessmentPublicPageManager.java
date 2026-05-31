package vacademy.io.assessment_service.features.open_registration.manager;


import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.entity.*;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.open_registration.dto.AssessmentPublicDto;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.RegisterOpenAssessmentRequestDto;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import java.util.*;

import static vacademy.io.common.auth.enums.CompanyStatus.ACTIVE;

@Component
public class AssessmentPublicPageManager {

    @Autowired
    AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    AssessmentRepository assessmentRepository;

    public ResponseEntity<GetAssessmentPublicResponseDto> getAssessmentPage(String code) {
        Optional<AssessmentInstituteMapping> assessmentInstituteMapping = assessmentInstituteMappingRepository.findTopByAssessmentUrl(code);

        if (assessmentInstituteMapping.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        Assessment assessment = assessmentInstituteMapping.get().getAssessment();

        if (assessment.getBoundEndTime() != null && assessment.getBoundEndTime().before(new Date())) {
            throw new VacademyException("Assessment is ended");
        }

        if (assessment.getRegistrationOpenDate() == null || assessment.getRegistrationCloseDate() == null) {
            // Private Assessments
            return ResponseEntity.ok(GetAssessmentPublicResponseDto.builder().instituteId(assessmentInstituteMapping.get().getInstituteId()).assessmentPublicDto(new AssessmentPublicDto(assessment)).serverTimeInGmt(DateUtil.getCurrentUtcTime()).canRegister(false).errorMessage("Assessment is Private").build());
        }


        if (assessment.getRegistrationOpenDate().before(new Date()) && assessment.getRegistrationCloseDate().after(new Date())) {
            return ResponseEntity.ok(GetAssessmentPublicResponseDto.builder().instituteId(assessmentInstituteMapping.get().getInstituteId()).serverTimeInGmt(DateUtil.getCurrentUtcTime()).assessmentPublicDto(new AssessmentPublicDto(assessment)).canRegister(true).assessmentCustomFields(assessment.getAssessmentCustomFields()).build());
        }
        return ResponseEntity.ok(GetAssessmentPublicResponseDto.builder().instituteId(assessmentInstituteMapping.get().getInstituteId()).assessmentPublicDto(new AssessmentPublicDto(assessment)).serverTimeInGmt(DateUtil.getCurrentUtcTime()).canRegister(false).errorMessage("Assessment is closed").build());

    }

    private void validateRegisterRequest(Optional<Assessment> assessment) {

        if (assessment.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        if (assessment.get().getRegistrationOpenDate() == null || assessment.get().getRegistrationCloseDate() == null) {
            throw new VacademyException("Assessment not found");
        }

        if (!assessment.get().getRegistrationOpenDate().before(new Date()) || !assessment.get().getRegistrationCloseDate().after(new Date())) {
            throw new VacademyException("Assessment is closed");
        }

    }

    public ResponseEntity<ParticipantPublicResponseDto> getParticipantStatus(String assessmentId, String instituteId, String userId, String psIds) {
        Optional<AssessmentUserRegistration> assessmentUserRegistration = assessmentUserRegistrationRepository.findTopByUserIdAndAssessmentId(userId, assessmentId);

        if (assessmentUserRegistration.isEmpty()) {
            return checkBatchRegistration(assessmentId, instituteId, userId, psIds);
        }

        Optional<StudentAttempt> recentAttempt = assessmentUserRegistration.get().getStudentAttempts().stream().findFirst();

        if (recentAttempt.isEmpty()) {
            return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(assessmentUserRegistration.get().getAssessment().getReattemptCount()).isAlreadyRegistered(true).build());

        }

        Integer totalAttemptsGiven = assessmentUserRegistration.get().getStudentAttempts().size();
        Integer studentTotalAttempts = (assessmentUserRegistration.get().getReattemptCount() != null) ? assessmentUserRegistration.get().getReattemptCount() : assessmentUserRegistration.get().getAssessment().getReattemptCount();
        if (studentTotalAttempts == null) studentTotalAttempts = 1;
        Integer remainingAttempts = studentTotalAttempts - totalAttemptsGiven;
        return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(remainingAttempts).isAlreadyRegistered(true).lastAttemptStatus(recentAttempt.get().getStatus()).build());
    }

    public ResponseEntity<ParticipantPublicResponseDto> checkBatchRegistration(String assessmentId, String instituteId, String userId, String psIds) {
        Optional<Assessment> assessment = assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (assessment.isEmpty()) {
            throw new VacademyException("Assessment not found");
        }

        if (psIds == null || psIds.isEmpty()) {
            return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(assessment.get().getReattemptCount()).isAlreadyRegistered(false).build());
        }

        List<String> psIdList = List.of(psIds.split(","));

        Set<AssessmentBatchRegistration> batchRegistrations = assessment.get().getBatchRegistrations();

        for (AssessmentBatchRegistration batchRegistration : batchRegistrations) {
            if (psIdList.contains(batchRegistration.getId())) {
                return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(assessment.get().getReattemptCount()).isAlreadyRegistered(true).lastAttemptStatus(null).build());
            }
        }

        return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(assessment.get().getReattemptCount()).isAlreadyRegistered(false).build());
    }

    @Transactional
    public ResponseEntity<String> registerAssessment(String userId, RegisterOpenAssessmentRequestDto registerOpenAssessmentRequestDto) {
        Optional<Assessment> assessment = assessmentRepository.findByAssessmentIdAndInstituteId(registerOpenAssessmentRequestDto.getAssessmentId(), registerOpenAssessmentRequestDto.getInstituteId());
        validateRegisterRequest(assessment);

        BasicParticipantDTO participantDTO = registerOpenAssessmentRequestDto.getParticipantDTO();

        // Resolve the user id: prefer the participant payload, fall back to the query param.
        // This value is persisted into the UNIQUE(assessment_id, user_id) column, so a blank id
        // makes every anonymous registrant collide on user_id=''. Reject it up front instead of
        // letting the batch insert blow up with a raw 500 (duplicate key violation).
        String resolvedUserId = StringUtils.hasText(participantDTO.getUserId())
                ? participantDTO.getUserId()
                : userId;
        if (!StringUtils.hasText(resolvedUserId)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "A valid user is required to register for this assessment.");
        }
        participantDTO.setUserId(resolvedUserId);

        // The unique constraint is (assessment_id, user_id), and it covers soft-deleted rows too.
        // Look up any prior registration for this pair so we never blindly insert a duplicate.
        Optional<AssessmentUserRegistration> existingRegistration =
                assessmentUserRegistrationRepository.findTopByUserIdAndAssessmentId(resolvedUserId, registerOpenAssessmentRequestDto.getAssessmentId());
        if (existingRegistration.isPresent()) {
            AssessmentUserRegistration registration = existingRegistration.get();
            if ("DELETED".equalsIgnoreCase(registration.getStatus())) {
                // A previous registration was soft-deleted. Reactivate it in place — inserting a
                // fresh row would violate UNIQUE(assessment_id, user_id) against the deleted one.
                registration.setStatus(ACTIVE.name());
                registration.setRegistrationTime(new Date());
                registration.setReattemptCount((participantDTO.getReattemptCount() == null)
                        ? assessment.get().getReattemptCount() : participantDTO.getReattemptCount());
                assessmentUserRegistrationRepository.save(registration);
                return ResponseEntity.ok("Registered successfully");
            }
            // An active registration already exists — treat a repeat submission as idempotent.
            return ResponseEntity.ok("Already registered");
        }

        try {
            addUserToAssessment(participantDTO, userId, registerOpenAssessmentRequestDto.getInstituteId(), assessment.get(), registerOpenAssessmentRequestDto.getCustomFieldRequestList());
        } catch (DataIntegrityViolationException e) {
            String rootCause = e.getMostSpecificCause().getMessage();
            if (rootCause != null && rootCause.contains("assessment_user_registration_unique")) {
                // A concurrent identical submission raced past the existence check and won the
                // insert. Surface a clean conflict instead of the raw duplicate-key 500.
                throw new VacademyException(HttpStatus.CONFLICT, "You are already registered for this assessment.");
            }
            // Any other integrity violation is a different problem — don't mislabel it.
            throw e;
        }
        return ResponseEntity.ok("Registered successfully");
    }

    AssessmentUserRegistration addUserToAssessment(BasicParticipantDTO basicParticipantDTO, String userId, String instituteId, Assessment assessment, List<AssessmentRegistrationCustomFieldRequest> customFieldRequestList) {
        AssessmentUserRegistration assessmentParticipantRegistration = new AssessmentUserRegistration();
        assessmentParticipantRegistration.setAssessment(assessment);
        assessmentParticipantRegistration.setUserId(basicParticipantDTO.getUserId());
        assessmentParticipantRegistration.setUsername(basicParticipantDTO.getUsername());
        assessmentParticipantRegistration.setParticipantName(basicParticipantDTO.getFullName());
        assessmentParticipantRegistration.setPhoneNumber(basicParticipantDTO.getMobileNumber());
        assessmentParticipantRegistration.setFaceFileId(basicParticipantDTO.getFileId());
        assessmentParticipantRegistration.setUserEmail(basicParticipantDTO.getEmail());
        assessmentParticipantRegistration.setReattemptCount((basicParticipantDTO.getReattemptCount() == null) ? assessment.getReattemptCount() : basicParticipantDTO.getReattemptCount());
        assessmentParticipantRegistration.setInstituteId(instituteId);
        assessmentParticipantRegistration.setStatus(ACTIVE.name());
        assessmentParticipantRegistration.setSource(UserRegistrationSources.OPEN_REGISTRATION.name());
        assessmentParticipantRegistration.setSourceId(userId);
        assessmentParticipantRegistration.setRegistrationTime(new Date());
        addCustomUserValues(customFieldRequestList, assessmentParticipantRegistration);
        // saveAndFlush so a UNIQUE(assessment_id, user_id) violation surfaces here (inside the
        // caller's try/catch) rather than at transaction commit, where it could not be handled.
        return assessmentUserRegistrationRepository.saveAndFlush(assessmentParticipantRegistration);
    }

    void addCustomUserValues(List<AssessmentRegistrationCustomFieldRequest> customFields, AssessmentUserRegistration assessmentUserRegistration) {
        Set<AssessmentRegistrationCustomFieldResponse> customFieldResponses = new HashSet<>();

        for (AssessmentRegistrationCustomFieldRequest customField : customFields) {
            AssessmentRegistrationCustomFieldResponse customFieldResponse = new AssessmentRegistrationCustomFieldResponse();
            customFieldResponse.setAssessmentUserRegistration(assessmentUserRegistration);
            customFieldResponse.setAnswer(customField.getAnswer());
            customFieldResponse.setAssessmentCustomField(AssessmentCustomField.builder().id(customField.getAssessmentCustomFieldId()).build());
            customFieldResponse.setAssessmentUserRegistration(assessmentUserRegistration);
            customFieldResponses.add(customFieldResponse);
        }
        assessmentUserRegistration.setAssessmentRegistrationCustomFieldResponseList(customFieldResponses);
    }
}
