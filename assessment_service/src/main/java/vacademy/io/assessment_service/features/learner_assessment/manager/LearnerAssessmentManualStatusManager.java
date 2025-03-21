package vacademy.io.assessment_service.features.learner_assessment.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentSetMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.QuestionResponseEnum;
import vacademy.io.assessment_service.features.assessment.enums.ReleaseResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentSetMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.StudentAttemptService;
import vacademy.io.assessment_service.features.learner_assessment.dto.AssessmentAttemptUpdateRequest;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.LearnerManualAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.ManualAssessmentAttemptDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.ManualQuestionAttemptDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.ManualSectionAttemptDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptResultEnum;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.utils.DateUtil;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
public class LearnerAssessmentManualStatusManager {

    @Autowired
    StudentAttemptService studentAttemptService;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    @Autowired
    AssessmentSetMappingRepository assessmentSetMappingRepository;

    /**
     * Submits a manual assessment attempt.
     *
     * @param userDetails   The authenticated user details.
     * @param assessmentId  The ID of the assessment being submitted.
     * @param attemptId     The ID of the attempt.
     * @param request       The request containing assessment update data.
     * @return ResponseEntity containing a success message or an error.
     * @throws VacademyException if the attempt or assessment is invalid.
     */
    public ResponseEntity<String> submitManualAssessment(CustomUserDetails userDetails,
                                                         String assessmentId,
                                                         String attemptId,
                                                         AssessmentAttemptUpdateRequest request) {
        try {
            // Fetch student attempt from the database
            Optional<StudentAttempt> attemptOptional = studentAttemptService.getStudentAttemptById(attemptId);
            if (attemptOptional.isEmpty()) throw new VacademyException("Attempt Not Found");

            // Validate if the attempt belongs to the given assessment
            Assessment assessment = attemptOptional.get().getRegistration().getAssessment();
            if (!assessment.getId().equals(assessmentId)) throw new VacademyException("Assessment Not Found");

            // Check attempt status before proceeding
            if (attemptOptional.get().getStatus().equals("PREVIEW")) {
                throw new VacademyException("Attempt is in Preview");
            }

            if (attemptOptional.get().getStatus().equals("ENDED")) {
                throw new VacademyException("Attempt already Ended");
            }

            // Process and update the attempt for manual submission
            updateAttemptForManualSubmit(assessment, attemptOptional.get(), request);

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed to Submit: " + e.getMessage());
        }
    }

    /**
     * Updates the student attempt details for manual submission.
     *
     * @param assessment     The assessment associated with the attempt.
     * @param studentAttempt The attempt being updated.
     * @param request        The request containing the JSON data.
     * @throws JsonProcessingException if JSON parsing fails.
     */
    @Transactional
    private void updateAttemptForManualSubmit(Assessment assessment,
                                              StudentAttempt studentAttempt,
                                              AssessmentAttemptUpdateRequest request) throws JsonProcessingException {

        // Validate request
        if (Objects.isNull(request) || Objects.isNull(request.getJsonContent())) {
            throw new VacademyException("Invalid Request");
        }

        // Parse and validate the JSON data
        LearnerManualAttemptDataDto attemptData = studentAttemptService.validateAndCreateManualAttemptJsonObject(request.getJsonContent());
        Optional<AssessmentSetMapping> setMapping = assessmentSetMappingRepository.findById(request.getSetId());
        if (setMapping.isEmpty()) throw new VacademyException("SetId Not found");

        if (Objects.isNull(attemptData)) throw new VacademyException("Attempt Data is Null");

        // Extract client sync time from the parsed JSON
        String clientSyncTime = attemptData.getClientLastSync();
        ManualAssessmentAttemptDto assessmentAttemptDto = attemptData.getAssessment();

        // Update student attempt details
        studentAttempt.setStatus(AssessmentAttemptEnum.ENDED.name());
        studentAttempt.setSubmitTime(DateUtil.getCurrentUtcTime());
        studentAttempt.setAttemptData(request.getJsonContent());
        studentAttempt.setSubmitData(request.getJsonContent());
        studentAttempt.setResultStatus(AssessmentAttemptResultEnum.PENDING.name());
        studentAttempt.setReportReleaseStatus(ReleaseResultStatusEnum.PENDING.name());
        studentAttempt.setClientLastSync(DateUtil.convertStringToUTCDate(clientSyncTime));
        studentAttempt.setTotalTimeInSeconds(assessmentAttemptDto.getTimeElapsedInSeconds());
        studentAttempt.setAssessmentSetMapping(setMapping.get());

        // Save the updated attempt
        studentAttemptService.updateStudentAttempt(studentAttempt);

        // Generate question-wise marks asynchronously
        try {
            createQuestionWiseMarksWrapper(assessment, studentAttempt, request.getJsonContent(), attemptData);
        } catch (Exception e) {
            log.error(e.getMessage());
        }
    }

    /**
     * Asynchronously creates or updates question-wise marks data for manual assessments.
     *
     * @param assessment     The associated assessment.
     * @param studentAttempt The student attempt being evaluated.
     * @param jsonContent    The JSON content of the assessment data.
     * @param attemptData    The parsed attempt data.
     * @return CompletableFuture containing the list of created question-wise marks.
     */
    @Async
    public CompletableFuture<List<QuestionWiseMarks>> createQuestionWiseMarksWrapper(Assessment assessment,
                                                                                     StudentAttempt studentAttempt,
                                                                                     String jsonContent,
                                                                                     LearnerManualAttemptDataDto attemptData) {
        return CompletableFuture.completedFuture(
                questionWiseMarksService.createOrUpdateQuestionWiseMarksDataForManualAssessment(
                        assessment, studentAttempt, jsonContent, attemptData
                )
        );
    }




}
