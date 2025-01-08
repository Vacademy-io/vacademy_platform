package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.*;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddAccessAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddQuestionsAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AssessmentRegistrationsDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentVisibility;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.RandomGenerator;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Map;
import java.util.Optional;

import static vacademy.io.common.core.utils.DateUtil.convertStringToUTCDate;


@Component
public class AssessmentBasicDetailsManager {

    @Autowired
    AssessmentRepository assessmentRepository;

    @Autowired
    AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;

    public ResponseEntity<AssessmentSaveResponseDto> saveBasicAssessmentDetails(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {

        if (!StringUtils.hasText(assessmentId))
            return handleNewAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
        Optional<Assessment> assessmentOptional = assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (assessmentOptional.isEmpty())
            return handleNewAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);

        return handleExistingAssessment(user, basicAssessmentDetailsDTO, assessmentOptional.get(), instituteId, type);
    }

    private ResponseEntity<AssessmentSaveResponseDto> handleExistingAssessment(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, Assessment assessment, String instituteId, String type) {
        if(!assessment.getPlayMode().equals(type)) throw new VacademyException("Assessment type cannot be changed");

        Optional.ofNullable(basicAssessmentDetailsDTO.getAssessmentPreviewTime()).ifPresent(assessment::setPreviewTime);
        Optional.ofNullable(basicAssessmentDetailsDTO.getSwitchSections()).ifPresent(assessment::setCanSwitchSection);

        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getSubmissionType())) {
            assessment.setEvaluationType(EvaluationTypes.MANUAL.name());
            assessment.setSubmissionType(basicAssessmentDetailsDTO.getSubmissionType());
        }
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseReattemptRequest()).ifPresent(assessment::setCanRequestReattempt);
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseTimeIncreaseRequest()).ifPresent(assessment::setCanRequestTimeIncrease);
        addOrUpdateTestCreationData(assessment, null, basicAssessmentDetailsDTO.getTestCreation());
        addOrUpdateBoundationData(assessment, null, basicAssessmentDetailsDTO.getTestBoundation());
        addOrUpdateTestDurationData(assessment, null, basicAssessmentDetailsDTO.getTestDuration());

        assessment = assessmentRepository.save(assessment);
        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessment.getId(), AssessmentStatus.DRAFT.name()));
    }

    private ResponseEntity<AssessmentSaveResponseDto> handleNewAssessment(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {

        Assessment assessment = new Assessment();
        AssessmentInstituteMapping assessmentInstituteMapping = new AssessmentInstituteMapping();
        assessmentInstituteMapping.setInstituteId(instituteId);
        assessmentInstituteMapping.setAssessmentUrl(RandomGenerator.generateNumber(6));
        assessment.setStatus(AssessmentStatus.DRAFT.name());
        assessment.setPlayMode(type);
        assessment.setAssessmentVisibility(AssessmentVisibility.PRIVATE.name());
        Optional.ofNullable(basicAssessmentDetailsDTO.getAssessmentPreviewTime()).ifPresent(assessment::setPreviewTime);
        Optional.ofNullable(basicAssessmentDetailsDTO.getSwitchSections()).ifPresent(assessment::setCanSwitchSection);
        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getSubmissionType())) {
            assessment.setEvaluationType(EvaluationTypes.MANUAL.name());
            assessment.setSubmissionType(basicAssessmentDetailsDTO.getSubmissionType());
        }
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseReattemptRequest()).ifPresent(assessment::setCanRequestReattempt);
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseTimeIncreaseRequest()).ifPresent(assessment::setCanRequestTimeIncrease);
        addOrUpdateTestCreationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestCreation());
        addOrUpdateBoundationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestBoundation());
        addOrUpdateTestDurationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestDuration());

        assessment = assessmentRepository.save(assessment);
        assessmentInstituteMapping.setAssessment(assessment);
        assessmentInstituteMappingRepository.save(assessmentInstituteMapping);

        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessment.getId(), AssessmentStatus.DRAFT.name()));
    }


    private void addOrUpdateTestCreationData(Assessment assessment, AssessmentInstituteMapping assessmentInstituteMapping, BasicAssessmentDetailsDTO.TestCreation testCreation) {
        if (!ObjectUtils.isEmpty(testCreation)) {
            Optional.ofNullable(testCreation.getAssessmentName()).ifPresent(assessment::setName);
            if (assessmentInstituteMapping != null)
                Optional.ofNullable(testCreation.getSubjectId()).ifPresent(assessmentInstituteMapping::setSubjectId);
            Optional.ofNullable(testCreation.getAssessmentInstructionsHtml()).ifPresent((value) -> assessment.setInstructions(new AssessmentRichTextData(null, TextType.HTML.name(), value)));
        }
    }

    private void addOrUpdateTestDurationData(Assessment assessment, AssessmentInstituteMapping assessmentInstituteMapping, BasicAssessmentDetailsDTO.TestDuration testDuration) {
        if (!ObjectUtils.isEmpty(testDuration)) {
            Optional.ofNullable(testDuration.getEntireTestDuration()).ifPresent(assessment::setDuration);
            Optional.ofNullable(testDuration.getSectionWiseDuration()).ifPresent(assessment::setDurationDistribution);
        }
    }

    private void addOrUpdateBoundationData(Assessment assessment, AssessmentInstituteMapping assessmentInstituteMapping, BasicAssessmentDetailsDTO.LiveDateRange boundationData) {
        if (!ObjectUtils.isEmpty(boundationData)) {
            Optional.ofNullable(boundationData.getStartDate()).ifPresent((startDate) -> assessment.setBoundStartTime(convertStringToUTCDate(startDate)));
            Optional.ofNullable(boundationData.getEndDate()).ifPresent((endDate) -> assessment.setBoundEndTime(convertStringToUTCDate(endDate)));
        }
    }

    public ResponseEntity<AssessmentSaveResponseDto> saveQuestionsToAssessment(CustomUserDetails user, AddQuestionsAssessmentDetailsDTO basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        return ResponseEntity.ok(null);
    }

    public ResponseEntity<AssessmentSaveResponseDto> saveParticipantsToAssessment(CustomUserDetails user, AssessmentRegistrationsDto basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        return ResponseEntity.ok(null);

    }

    public ResponseEntity<AssessmentSaveResponseDto> publishAssessment(CustomUserDetails user, Map<String, String> data, String assessmentId, String instituteId, String type) {
        if (!StringUtils.hasText(assessmentId))
            throw new VacademyException("Assessment Id cannot be empty");
        Optional<Assessment> assessmentOptional = assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (assessmentOptional.isEmpty())
           throw new VacademyException("Assessment not found");

        // Todo: Verify Assessment Details based on type
        assessmentOptional.get().setStatus(AssessmentStatus.PUBLISHED.name());
        assessmentRepository.save(assessmentOptional.get());
        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessmentOptional.get().getId(), AssessmentStatus.PUBLISHED.name()));
    }

    public ResponseEntity<AssessmentSaveResponseDto> saveAccessToAssessment(CustomUserDetails user, AddAccessAssessmentDetailsDTO addAccessAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        return ResponseEntity.ok(null);
    }
}
