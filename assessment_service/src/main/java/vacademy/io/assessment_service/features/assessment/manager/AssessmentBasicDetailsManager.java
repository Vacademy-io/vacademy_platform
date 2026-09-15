package vacademy.io.assessment_service.features.assessment.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
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

    @Autowired
    vacademy.io.assessment_service.features.assessment.service.AssessmentWorkflowEventPublisher assessmentWorkflowEventPublisher;

    public ResponseEntity<AssessmentSaveResponseDto> saveBasicAssessmentDetails(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {

        if (!StringUtils.hasText(assessmentId))
            return handleNewAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
        Optional<Assessment> assessmentOptional = assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (assessmentOptional.isEmpty())
            return handleNewAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);

        return handleExistingAssessment(user, basicAssessmentDetailsDTO, assessmentOptional.get(), instituteId, type);
    }

    private ResponseEntity<AssessmentSaveResponseDto> handleExistingAssessment(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, Assessment assessment, String instituteId, String type) {
        if (!assessment.getPlayMode().equals(type)) throw new VacademyException("Assessment type cannot be changed");

        Optional.ofNullable(basicAssessmentDetailsDTO.getAssessmentPreviewTime()).ifPresent(assessment::setPreviewTime);
        Optional.ofNullable(basicAssessmentDetailsDTO.getSwitchSections()).ifPresent(assessment::setCanSwitchSection);
        Optional.ofNullable(basicAssessmentDetailsDTO.getHasOmrMode()).ifPresent(assessment::setOmrMode);
        Optional.ofNullable(basicAssessmentDetailsDTO.getDefaultReattemptCount()).ifPresent(assessment::setReattemptCount);
        Optional.ofNullable(basicAssessmentDetailsDTO.getAssessmentType()).ifPresent(assessment::setAssessmentType);
        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getSubmissionType())) {
            assessment.setSubmissionType(basicAssessmentDetailsDTO.getSubmissionType());
        } else {
            assessment.setSubmissionType(EvaluationTypes.AUTO.name());
        }

        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getEvaluationType())) {
            assessment.setEvaluationType(basicAssessmentDetailsDTO.getEvaluationType());
        } else {
            assessment.setEvaluationType(EvaluationTypes.AUTO.name());
        }
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseReattemptRequest()).ifPresent(assessment::setCanRequestReattempt);
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseTimeIncreaseRequest()).ifPresent(assessment::setCanRequestTimeIncrease);
        Optional.ofNullable(basicAssessmentDetailsDTO.getResultType()).ifPresent(assessment::setResultType);
        // ifPresent, not a plain set: AI evaluation spends institute credits, so a
        // partial basic-details save must never flip it on or off by omission.
        Optional.ofNullable(basicAssessmentDetailsDTO.getAiEvaluationEnabled())
                .ifPresent(assessment::setAiEvaluationEnabled);
        Optional.ofNullable(basicAssessmentDetailsDTO.getAiEvaluationModel())
                .ifPresent(assessment::setAiEvaluationModel);

        // The subject lives on the institute mapping, not the assessment. Load it
        // so subject changes are persisted on edit; without this the mapping is
        // never saved and the subject silently stays as it was ("N/A").
        AssessmentInstituteMapping assessmentInstituteMapping = assessmentInstituteMappingRepository
                .findByAssessmentIdAndInstituteId(assessment.getId(), instituteId)
                .orElse(null);
        addOrUpdateTestCreationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestCreation());
        addOrUpdateBoundationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestBoundation());

        assessment = assessmentRepository.save(assessment);
        if (assessmentInstituteMapping != null) {
            assessmentInstituteMappingRepository.save(assessmentInstituteMapping);
        }
        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessment.getId(), AssessmentStatus.DRAFT.name()));
    }

    private ResponseEntity<AssessmentSaveResponseDto> handleNewAssessment(CustomUserDetails user, BasicAssessmentDetailsDTO basicAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {

        Assessment assessment = new Assessment();
        AssessmentInstituteMapping assessmentInstituteMapping = new AssessmentInstituteMapping();
        assessmentInstituteMapping.setInstituteId(instituteId);
        assessmentInstituteMapping.setAssessmentUrl(RandomGenerator.generateNumber(6));
        assessment.setStatus(AssessmentStatus.DRAFT.name());
        assessment.setAssessmentType(basicAssessmentDetailsDTO.getAssessmentType());
        Optional.ofNullable(basicAssessmentDetailsDTO.getDefaultReattemptCount()).ifPresent(assessment::setReattemptCount);
        Optional.ofNullable(basicAssessmentDetailsDTO.getHasOmrMode()).ifPresent(assessment::setOmrMode);
        assessment.setPlayMode(type);
        assessment.setAssessmentVisibility(AssessmentVisibility.PRIVATE.name());
        Optional.ofNullable(basicAssessmentDetailsDTO.getAssessmentPreviewTime()).ifPresent(assessment::setPreviewTime);
        Optional.ofNullable(basicAssessmentDetailsDTO.getSwitchSections()).ifPresent(assessment::setCanSwitchSection);
        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getSubmissionType())) {
            assessment.setSubmissionType(basicAssessmentDetailsDTO.getSubmissionType());
        } else {
            assessment.setSubmissionType(EvaluationTypes.AUTO.name());
        }

        if (!ObjectUtils.isEmpty(basicAssessmentDetailsDTO.getEvaluationType())) {
            assessment.setEvaluationType(basicAssessmentDetailsDTO.getEvaluationType());
        } else {
            assessment.setEvaluationType(EvaluationTypes.AUTO.name());
        }
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseReattemptRequest()).ifPresent(assessment::setCanRequestReattempt);
        Optional.ofNullable(basicAssessmentDetailsDTO.getRaiseTimeIncreaseRequest()).ifPresent(assessment::setCanRequestTimeIncrease);
        Optional.ofNullable(basicAssessmentDetailsDTO.getResultType()).ifPresent(assessment::setResultType);
        // ifPresent, not a plain set: AI evaluation spends institute credits, so a
        // partial basic-details save must never flip it on or off by omission.
        Optional.ofNullable(basicAssessmentDetailsDTO.getAiEvaluationEnabled())
                .ifPresent(assessment::setAiEvaluationEnabled);
        Optional.ofNullable(basicAssessmentDetailsDTO.getAiEvaluationModel())
                .ifPresent(assessment::setAiEvaluationModel);
        addOrUpdateTestCreationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestCreation());
        addOrUpdateBoundationData(assessment, assessmentInstituteMapping, basicAssessmentDetailsDTO.getTestBoundation());

        assessment = assessmentRepository.save(assessment);
        assessmentInstituteMapping.setAssessment(assessment);
        assessmentInstituteMappingRepository.save(assessmentInstituteMapping);

        // Trigger ASSESSMENT_CREATE workflow
        assessmentWorkflowEventPublisher.publishAssessmentCreated(assessment, instituteId,
                user != null ? user.getUserId() : null);

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
        Assessment assessment = assessmentOptional.get();
        // Publish is idempotent — the endpoint can be hit again on an already-published
        // assessment. Only an actual DRAFT -> PUBLISHED transition should notify anyone,
        // otherwise a re-publish re-blasts every registered learner.
        boolean wasUnpublished = !AssessmentStatus.PUBLISHED.name().equals(assessment.getStatus());
        assessment.setStatus(AssessmentStatus.PUBLISHED.name());
        assessment = assessmentRepository.save(assessment);

        // Trigger ASSESSMENT_PUBLISHED workflow
        if (wasUnpublished) {
            assessmentWorkflowEventPublisher.publishAssessmentPublished(assessment, instituteId,
                    user != null ? user.getUserId() : null);
        }

        return ResponseEntity.ok(new AssessmentSaveResponseDto(assessment.getId(), AssessmentStatus.PUBLISHED.name()));
    }

    public ResponseEntity<AssessmentSaveResponseDto> saveAccessToAssessment(CustomUserDetails user, AddAccessAssessmentDetailsDTO addAccessAssessmentDetailsDTO, String assessmentId, String instituteId, String type) {
        return ResponseEntity.ok(null);
    }
}
