package vacademy.io.assessment_service.features.open_registration.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.enums.UserRegistrationSources;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;
import vacademy.io.assessment_service.features.open_registration.dto.AssessmentPublicDto;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.RegisterOpenAssessmentRequestDto;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import java.util.Date;
import java.util.List;
import java.util.Optional;

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

        if (!assessmentInstituteMapping.isPresent()) {
            throw new VacademyException("Assessment not found");
        }

        Assessment assessment = assessmentInstituteMapping.get().getAssessment();

        if (assessment.getRegistrationOpenDate() == null || assessment.getRegistrationCloseDate() == null) {
            throw new VacademyException("Assessment not found");
        }

        if (assessment.getRegistrationOpenDate().before(new Date()) && assessment.getRegistrationCloseDate().after(new Date())) {
            return ResponseEntity.ok(GetAssessmentPublicResponseDto.builder().instituteId(assessmentInstituteMapping.get().getInstituteId()).assessmentPublicDto(new AssessmentPublicDto(assessment)).canRegister(true).assessmentCustomFields(assessment.getAssessmentCustomFields()).build());
        }
        return ResponseEntity.ok(GetAssessmentPublicResponseDto.builder().instituteId(assessmentInstituteMapping.get().getInstituteId()).assessmentPublicDto(new AssessmentPublicDto(assessment)).canRegister(false).errorMessage("Assessment is closed").build());

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

    public ResponseEntity<ParticipantPublicResponseDto> getParticipantStatus(String assessmentId, String instituteId, String userId) {
        Optional<AssessmentUserRegistration> assessmentUserRegistration = assessmentUserRegistrationRepository.findTopByUserIdAndAssessmentId(userId, assessmentId);

        if (assessmentUserRegistration.isEmpty()) {
            return ResponseEntity.ok(ParticipantPublicResponseDto.builder().remainingAttempts(assessmentUserRegistration.get().getAssessment().getReattemptCount()).isAlreadyRegistered(false).build());
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

    public ResponseEntity<String> registerAssessment(CustomUserDetails user, RegisterOpenAssessmentRequestDto registerOpenAssessmentRequestDto) {
        Optional<Assessment> assessment = assessmentRepository.findByAssessmentIdAndInstituteId(registerOpenAssessmentRequestDto.getAssessmentId(), registerOpenAssessmentRequestDto.getInstituteId());
        validateRegisterRequest(assessment);

        addUserToAssessment(registerOpenAssessmentRequestDto.getParticipantDTO(), user.getUserId(), registerOpenAssessmentRequestDto.getInstituteId(), assessment.get());

        return ResponseEntity.ok("Registered successfully");
    }

    AssessmentUserRegistration addUserToAssessment(BasicParticipantDTO basicParticipantDTO, String userId, String instituteId, Assessment assessment) {
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
        return assessmentParticipantRegistration;
    }
}
