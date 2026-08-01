package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.QuestionWiseBasicDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request.RevaluateRequest;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AttemptResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.enums.ReleaseResultStatusEnum;
import vacademy.io.assessment_service.features.assessment.enums.ResultTypeEnum;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.constants.AttemptJsonConstants;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.LearnerManualAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptEnum;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptResultEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.notification.service.AssessmentNotificationService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.StreamSupport;

@Slf4j
@Service
public class StudentAttemptService {

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    @Autowired
    SectionRepository sectionRepository;

    @Autowired
    AssessmentNotificationService assessmentNotificationService;

    @Autowired
    AttemptDataParserService attemptDataParserService;

    /**
     * Self-reference through the Spring proxy.
     *
     * <p>
     * The scoring entry points below are called from the {@code @Async} wrappers in
     * this same class. A plain {@code this.} call bypasses the proxy, which silently
     * disabled the {@code @Transactional} on
     * {@link #calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks} and the
     * {@code @CacheEvict} on the calculation methods. Without a surrounding
     * transaction every single repository call ran in its own auto-commit
     * transaction, taking and releasing a pool connection each time — roughly four
     * checkouts per question, so ~200 for a 50-question paper on every learner sync.
     *
     * <p>
     * Routing through the proxy restores one transaction per scoring pass, which also
     * lets Hibernate batch the question_wise_marks writes (batch_size=50,
     * order_updates=true are already configured) into a couple of round trips instead
     * of one per question. {@code @Lazy} breaks the circular self-dependency at
     * construction time.
     */
    @Lazy
    @Autowired
    private StudentAttemptService self;

    /**
     * ObjectMapper is thread-safe once configured and is expensive to construct — it
     * builds serializer/deserializer caches each time. It used to be instantiated per
     * call inside the per-question scoring loop, so a 50-question paper built hundreds
     * of them per learner per minute on a pod capped at 750m CPU.
     */
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public StudentAttempt updateStudentAttempt(StudentAttempt studentAttempt) {
        return studentAttemptRepository.save(studentAttempt);
    }

    public StudentAttempt updateLeaderBoard(StudentAttempt studentAttempt) {
        return updateStudentAttempt(studentAttempt);
    }

    public void releaseResultsForEndedAutoReleaseAssessments() {
        List<StudentAttempt> unreleased = studentAttemptRepository.findUnreleasedAttemptsForEndedAutoReleaseAssessments();
        Date now = new Date();
        for (StudentAttempt attempt : unreleased) {
            attempt.setReportReleaseStatus(ReleaseResultStatusEnum.RELEASED.name());
            attempt.setReportLastReleaseDate(now);
        }
        if (!unreleased.isEmpty()) {
            studentAttemptRepository.saveAll(unreleased);
            log.info("[AUTO-RELEASE] Released results for {} attempts after assessment end", unreleased.size());
        }
    }


    @Async
    public CompletableFuture<StudentAttempt> updateStudentAttemptWithTotalAfterMarksCalculationAsync(Optional<StudentAttempt> studentAttemptOptional) {
        // via self (proxy) so @Transactional/@CacheEvict on the target actually apply
        return CompletableFuture.completedFuture(self.updateStudentAttemptWithTotalAfterMarksCalculation(studentAttemptOptional));
    }

    @Async
    public CompletableFuture<StudentAttempt> updateStudentAttemptResultAfterMarksCalculationAsync(Optional<StudentAttempt> studentAttemptOptional) {
        // via self (proxy) so @Transactional/@CacheEvict on the target actually apply
        return CompletableFuture.completedFuture(self.updateStudentAttemptWithResultAfterMarksCalculation(studentAttemptOptional));
    }

    @Transactional
    @CacheEvict(value = "comparisonData", allEntries = true)
    public StudentAttempt updateStudentAttemptWithResultAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional) {
        if (studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();

        Long timeElapsedInSeconds = attemptDataParserService.getTimeElapsedInSecondsFromAttemptData(attemptData);

        double totalMarks = calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(studentAttemptOptional);

        StudentAttempt attempt = studentAttemptOptional.get();

        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);

        // MANUAL-evaluation assessments are graded by an evaluator (tool or AI),
        // which sets COMPLETED itself. Auto marks calculation (submit flow /
        // attempt-expiry cron) must not flip such attempts to COMPLETED
        // ("Evaluated") or release their results.
        boolean isManualEvaluation = isManualEvaluationAssessment(attempt);
        if (isManualEvaluation) {
            if (!AssessmentAttemptResultEnum.COMPLETED.name().equals(attempt.getResultStatus())) {
                attempt.setResultStatus(AssessmentAttemptResultEnum.PENDING.name());
            }
        } else {
            attempt.setResultMarks(totalMarks);
            attempt.setResultStatus(AssessmentAttemptResultEnum.COMPLETED.name());
        }
        if(!attempt.getStatus().equals(AssessmentAttemptEnum.ENDED.name())){
            attempt.setStatus(AssessmentAttemptEnum.ENDED.name());
        }

        // Auto-release result based on assessment's result_type
        if (!isManualEvaluation) {
            autoReleaseResultIfApplicable(attempt);
        }

        return studentAttemptRepository.save(attempt);
    }

    private boolean isManualEvaluationAssessment(StudentAttempt attempt) {
        try {
            Assessment assessment = attempt.getRegistration().getAssessment();
            return assessment != null
                    && EvaluationTypes.MANUAL.name().equals(assessment.getEvaluationType());
        } catch (Exception e) {
            log.error("Failed to resolve evaluation type for attempt {}: {}", attempt.getId(), e.getMessage());
            return false;
        }
    }


    @Transactional
    @CacheEvict(value = "comparisonData", allEntries = true)
    public StudentAttempt updateStudentAttemptWithTotalAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional) {
        if (studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();

        Long timeElapsedInSeconds = attemptDataParserService.getTimeElapsedInSecondsFromAttemptData(attemptData);

        double totalMarks = calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(studentAttemptOptional);

        StudentAttempt attempt = studentAttemptOptional.get();
        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);

        return studentAttemptRepository.save(attempt);

    }


    private void autoReleaseResultIfApplicable(StudentAttempt attempt) {
        try {
            Assessment assessment = attempt.getRegistration().getAssessment();
            String resultType = assessment.getResultType();
            if (resultType == null) return;

            if (ResultTypeEnum.AUTO_AFTER_SUBMISSION.name().equals(resultType)) {
                attempt.setReportReleaseStatus(ReleaseResultStatusEnum.RELEASED.name());
                attempt.setReportLastReleaseDate(new Date());
            } else if (ResultTypeEnum.AUTO_AFTER_ASSESSMENT_END.name().equals(resultType)) {
                Date now = new Date();
                if (assessment.getBoundEndTime() != null && now.after(assessment.getBoundEndTime())) {
                    attempt.setReportReleaseStatus(ReleaseResultStatusEnum.RELEASED.name());
                    attempt.setReportLastReleaseDate(now);
                }
            }
        } catch (Exception e) {
            log.error("Failed to auto-release result for attempt {}: {}", attempt.getId(), e.getMessage());
        }
    }

    @Transactional
    public Double calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(Optional<StudentAttempt> studentAttemptOptional) {
        return calculateTotalMarks(studentAttemptOptional);
    }

    /**
     * Indexes every question in the attempt payload by question id, in a single parse.
     *
     * <p>
     * The scoring loop previously called {@link #getQuestionDetails(String, String)}
     * once per question, and each of those calls re-parsed the <em>entire</em> attempt
     * blob to find one question — O(Q&sup2;) parsing per learner per sync. Attempt
     * payloads run to 293 KB at the top end, so a long paper re-parsed megabytes of
     * JSON every minute, per learner, on a 750m-CPU pod.
     *
     * <p>
     * Values are produced by the same {@code writeValueAsString} call on the same node
     * as before, so the strings persisted to {@code question_wise_marks.response_json}
     * are unchanged.
     */
    private Map<String, String> buildQuestionJsonIndex(String attemptDataJson) {
        Map<String, String> index = new HashMap<>();
        if (Objects.isNull(attemptDataJson)) return index;
        try {
            JsonNode rootNode = OBJECT_MAPPER.readTree(attemptDataJson);
            for (JsonNode section : rootNode.path(AttemptJsonConstants.sections)) {
                for (JsonNode question : section.path(AttemptJsonConstants.questions)) {
                    String questionId = question.path(AttemptJsonConstants.questionId).asText();
                    if (questionId != null && !questionId.isEmpty()) {
                        // putIfAbsent, NOT put: getQuestionDetails returns on its FIRST
                        // match and stops. 930 assessments in prod map the same
                        // question_id into more than one section, so last-write-wins
                        // here would score those against a different section's response
                        // than the original code did.
                        index.putIfAbsent(questionId, OBJECT_MAPPER.writeValueAsString(question));
                    }
                }
            }
        } catch (Exception e) {
            // Fall back to the per-question lookup path rather than failing the scoring pass.
            log.error("Failed to index attempt question payloads: {}", e.getMessage());
        }
        return index;
    }

    /**
     * This method calculates the total marks for a learner's assessment attempt based on the questions
     * they answered and their responses. It iterates over the sections and questions, applying the
     * appropriate marking strategy for each question type.
     *
     * @param studentAttemptOptional - The student's attempt details, wrapped in an Optional.
     * @return The total marks for the learner's attempt.
     * @throws Exception - If any error occurs during the calculation.
     */
    public double calculateTotalMarks(Optional<StudentAttempt> studentAttemptOptional){
        try{
            double totalMarks = 0.0;

            if (studentAttemptOptional.isEmpty()) {
                return 0.0;
            }

            StudentAttempt studentAttempt = studentAttemptOptional.get();
            Assessment assessment = studentAttempt.getRegistration().getAssessment();
            String attemptData = studentAttempt.getAttemptData();

            List<String> sectionList = attemptDataParserService.extractSectionJsonStrings(attemptData);

            // Parse the attempt payload once up front instead of once per question.
            Map<String, String> questionJsonIndex = buildQuestionJsonIndex(attemptData);

            for (String section : sectionList) {
                totalMarks += calculateMarksForSection(section, attemptData, questionJsonIndex, assessment, studentAttempt);
            }

            return totalMarks;
        } catch (Exception e) {
            log.error("Failed To Calculate Marks: " +e.getMessage());
            return 0.0;
        }
    }

    private double calculateMarksForSection(String sectionJson, String attemptData, Map<String, String> questionJsonIndex, Assessment assessment, StudentAttempt studentAttempt) {
        double sectionMarks = 0.0;
        List<String> questionJsons = attemptDataParserService.extractQuestionJsonsFromSection(sectionJson);

        for (String question : questionJsons) {
            sectionMarks += calculateMarksForQuestion(sectionJson, question, attemptData, questionJsonIndex, assessment, studentAttempt);
        }

        return sectionMarks;
    }

    private double calculateMarksForQuestion(String sectionJson, String questionJson, String attemptData, Map<String, String> questionJsonIndex, Assessment assessment, StudentAttempt studentAttempt) {
        String sectionId = attemptDataParserService.extractSectionIdFromSectionJson(sectionJson);
        String questionId = attemptDataParserService.extractQuestionIdFromQuestionJson(questionJson);

        String type = attemptDataParserService.extractResponseTypeFromQuestionJson(questionJson);

        Optional<QuestionAssessmentSectionMapping> questionAssessmentSectionMapping =
                questionAssessmentSectionMappingRepository.findByQuestionIdAndSectionId(questionId, sectionId);

        if (questionAssessmentSectionMapping.isEmpty()) {
            return 0.0;
        }

        QuestionAssessmentSectionMapping markingScheme = questionAssessmentSectionMapping.get();
        Question questionAsked = markingScheme.getQuestion();
        // Prebuilt index; falls back to the original full-blob scan if indexing failed.
        String questionWiseResponseData = questionJsonIndex.containsKey(questionId)
                ? questionJsonIndex.get(questionId)
                : getQuestionDetails(questionId, attemptData);

        QuestionWiseBasicDetailDto questionWiseBasicDetailDto = QuestionBasedStrategyFactory.calculateMarks(
                markingScheme.getMarkingJson(),
                questionAsked.getAutoEvaluationJson(),
                questionWiseResponseData,
                type
        );
        double marksObtained = questionWiseBasicDetailDto.getMarks();
        String answerStatus = questionWiseBasicDetailDto.getAnswerStatus();

        Optional<Section> sectionOptional = sectionRepository.findById(sectionId);
        if (sectionOptional.isEmpty()) throw new VacademyException("Section Not Found");

        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(
                assessment, studentAttempt, questionAsked, questionWiseResponseData, attemptDataParserService.extractTimeTakenInSecondsFromQuestionJson(questionJson), answerStatus, sectionOptional.get(), marksObtained
        );

        return marksObtained;
    }

    public LearnerAssessmentAttemptDataDto validateAndCreateJsonObject(String jsonContent) {
        try {
            return OBJECT_MAPPER.readValue(jsonContent, LearnerAssessmentAttemptDataDto.class);
        } catch (Exception e) {
            throw new VacademyException("Invalid json format: " + e.getMessage());
        }
    }

    public LearnerManualAttemptDataDto validateAndCreateManualAttemptJsonObject(String jsonContent) {
        try {
            return OBJECT_MAPPER.readValue(jsonContent, LearnerManualAttemptDataDto.class);
        } catch (Exception e) {
            throw new VacademyException("Invalid json format: " + e.getMessage());
        }
    }

    public String getQuestionDetails(String questionId, String attemptDataJson) {
        try {
            JsonNode rootNode = OBJECT_MAPPER.readTree(attemptDataJson);

            // Iterate over the sections array
            JsonNode sections = rootNode.path(AttemptJsonConstants.sections);
            for (JsonNode section : sections) {
                JsonNode questions = section.path(AttemptJsonConstants.questions);

                // Iterate over the questions in the current section
                for (JsonNode question : questions) {
                    // Compare question_id to find the correct question
                    if (question.path(AttemptJsonConstants.questionId).asText().equals(questionId)) {
                        return OBJECT_MAPPER.writeValueAsString(question); // Return question as JSON string
                    }
                }
            }
            return "{}"; // Return empty JSON if questionId not found
        } catch (Exception e) {
            return "{}"; // Return empty JSON in case of error
        }
    }

    public List<StudentAttempt> getStudentAttemptsByIds(List<String> attemptIds) {
        return StreamSupport
                .stream(studentAttemptRepository.findAllById(attemptIds).spliterator(), false)
                .toList();
    }

    public List<StudentAttempt> getAllParticipantsAttemptForAssessment(String assessmentId) {
        return studentAttemptRepository.findAllParticipantsFromAssessmentAndStatusNotIn(assessmentId, List.of("DELETED"));
    }

    public void revaluateForAllParticipants(String assessmentId) {
        List<StudentAttempt> allAttempts = studentAttemptRepository.findAllParticipantsFromAssessmentAndStatusNotIn(assessmentId, List.of("DELETED"));
        revaluateAssessmentForAttempts(allAttempts);
    }

    public void revaluateAssessmentForAttempts(List<StudentAttempt> allAttempts) {
        // Through the proxy (see the `self` field) so each attempt is rescored in its
        // own transaction and its question_wise_marks writes batch, instead of one
        // auto-commit round trip per question across the whole participant list.
        allAttempts.forEach(attempt -> {
            if (attempt.getStatus().equals("ENDED")) {
                self.updateStudentAttemptWithResultAfterMarksCalculation(Optional.of(attempt));
            } else if (attempt.getStatus().equals("LIVE")) {
                self.updateStudentAttemptWithTotalAfterMarksCalculation(Optional.of(attempt));
            }

        });
    }

    public void revaluateForCustomParticipantsAndQuestions(Assessment assessment, RevaluateRequest request) {
        List<StudentAttempt> allAttempts = StreamSupport
                .stream(studentAttemptRepository.findAllById(request.getAttemptIds()).spliterator(), false)
                .toList();

        List<RevaluateRequest.RevaluateQuestionDto> questionDtos = request.getQuestions();
        questionDtos.forEach(question -> {
            String sectionId = question.getSectionId();
            List<String> questionIds = question.getQuestionIds();

            for (StudentAttempt attempt : allAttempts) {
                calculateMarksForSectionIdAndQuestionIds(Optional.of(attempt), sectionId, questionIds, assessment);
                updateMarksAfterRevaluation(attempt, assessment.getId());
            }
        });
    }

    @Async
    public CompletableFuture<Void> revaluateForAllParticipantsWrapper(Assessment assessment, String instituteId) {
        return CompletableFuture.runAsync(() -> revaluateForAllParticipants(assessment.getId()))
                .thenRun(() -> sendEmail(instituteId, assessment));
    }

    @Async
    public CompletableFuture<Void> revaluateForParticipantIdsWrapper(Assessment assessment, List<String> allAttemptIds, String instituteId) {
        List<StudentAttempt> allAttempts = StreamSupport
                .stream(studentAttemptRepository.findAllById(allAttemptIds).spliterator(), false)
                .toList();

        return CompletableFuture.runAsync(() -> revaluateAssessmentForAttempts(allAttempts))
                .thenRun(() -> sendEmail(instituteId, assessment));
    }

    @Async
    public CompletableFuture<Void> revaluateCustomParticipantAndQuestionsWrapper(Assessment assessment, RevaluateRequest request, String instituteId) {

        return CompletableFuture.runAsync(() -> revaluateForCustomParticipantsAndQuestions(assessment, request))
                .thenRun(() -> sendEmail(instituteId, assessment));
    }


    public void updateMarksAfterRevaluation(StudentAttempt studentAttempt, String assessmentId) {
        List<QuestionWiseMarks> allQuestionWiseMarks = questionWiseMarksService.getAllQuestionWiseMarksForAttemptId(studentAttempt.getId(), assessmentId);
        double totalMarks = 0.0;

        for (QuestionWiseMarks questionWiseMarks : allQuestionWiseMarks) {
            totalMarks += questionWiseMarks.getMarks();
        }

        studentAttempt.setTotalMarks(totalMarks);
        if (studentAttempt.getStatus().equals("ENDED")) {
            studentAttempt.setResultMarks(totalMarks);
        }

        studentAttemptRepository.save(studentAttempt);
    }

    public void calculateMarksForSectionIdAndQuestionIds(Optional<StudentAttempt> studentAttemptOptional, String sectionId, List<String> questionIds, Assessment assessment) {
        questionIds.forEach(questionId -> {
            calculateMarksForSectionIdAndQuestionId(studentAttemptOptional, sectionId, questionId, assessment);
        });
    }


    public double calculateMarksForSectionIdAndQuestionId(Optional<StudentAttempt> studentAttemptOptional, String sectionId, String questionId, Assessment assessment) {
        if (studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        String jsonAttemptData = studentAttempt.getAttemptData();
        if (Objects.isNull(jsonAttemptData)) return 0.0;

        Optional<QuestionAssessmentSectionMapping> questionAssessmentSectionMapping =
                questionAssessmentSectionMappingRepository.findByQuestionIdAndSectionId(questionId, sectionId);

        if (questionAssessmentSectionMapping.isEmpty()) {
            return 0.0;
        }

        QuestionAssessmentSectionMapping markingScheme = questionAssessmentSectionMapping.get();
        Question questionAsked = markingScheme.getQuestion();
        String questionWiseResponseData = getQuestionDetails(questionId, jsonAttemptData);

        QuestionWiseBasicDetailDto questionWiseBasicDetailDto = QuestionBasedStrategyFactory.calculateMarks(
                markingScheme.getMarkingJson(),
                questionAsked.getAutoEvaluationJson(),
                questionWiseResponseData,
                questionAsked.getQuestionType()
        );

        double marksObtained = questionWiseBasicDetailDto.getMarks();
        String answerStatus = questionWiseBasicDetailDto.getAnswerStatus();

        Section section = questionAssessmentSectionMapping.get().getSection();

        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(
                assessment, studentAttempt, questionAsked, questionWiseResponseData, null, answerStatus, section, marksObtained
        );

        return marksObtained;
    }


    private void sendEmail(String instituteId, Assessment assessment) {
        assessmentNotificationService.sendNotificationsToAdminsAfterReevaluating(assessment, instituteId);
    }

    public Optional<StudentAttempt> getStudentAttemptById(String id) {
        return studentAttemptRepository.findById(id);
    }

    public Page<ManualAttemptResponseDto> getAllManualAssignedAttempt(String userId, String assessmentId, String instituteId, String name, List<String> evaluationStatus, Pageable pageable) {
        if (Objects.isNull(evaluationStatus)) evaluationStatus = new ArrayList<>();
        return studentAttemptRepository.findAllAssignedAttemptForUserIdWithFilter(userId, instituteId, assessmentId, name, evaluationStatus, pageable);
    }

    public List<StudentAttempt> getAllLiveAttempt() {
        return studentAttemptRepository.findByStatusNotIn(List.of(AssessmentAttemptEnum.ENDED.name()));
    }

    public List<StudentAttempt> getAllAttemptsFromIds(List<String> attemptIds) {
        return StreamSupport.stream(studentAttemptRepository.findAllById(attemptIds).spliterator(), false)
                .toList();
    }
}
