package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.SectionRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.constants.AttemptJsonConstants;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.manual.LearnerManualAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.enums.AssessmentAttemptResultEnum;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.notification.service.AssessmentNotificationService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
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

    public StudentAttempt updateStudentAttempt(StudentAttempt studentAttempt){
        return studentAttemptRepository.save(studentAttempt);
    }

    public StudentAttempt updateLeaderBoard(StudentAttempt studentAttempt){
        return updateStudentAttempt(studentAttempt);
    }


    @Async
    public CompletableFuture<StudentAttempt> updateStudentAttemptWithTotalAfterMarksCalculationAsync(Optional<StudentAttempt> studentAttemptOptional){
        return CompletableFuture.completedFuture(updateStudentAttemptWithTotalAfterMarksCalculation(studentAttemptOptional));
    }

    @Async
    public CompletableFuture<StudentAttempt> updateStudentAttemptResultAfterMarksCalculationAsync(Optional<StudentAttempt> studentAttemptOptional){
        return CompletableFuture.completedFuture(updateStudentAttemptWithResultAfterMarksCalculation(studentAttemptOptional));
    }

    public StudentAttempt updateStudentAttemptWithResultAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional){
        if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();

        Long timeElapsedInSeconds = attemptDataParserService.getTimeElapsedInSecondsFromAttemptData(attemptData);

        double totalMarks = calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(studentAttemptOptional);

        StudentAttempt attempt = studentAttemptOptional.get();

        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);
        attempt.setResultMarks(totalMarks);
        attempt.setResultStatus(AssessmentAttemptResultEnum.COMPLETED.name());

        return studentAttemptRepository.save(attempt);
    }


    public StudentAttempt updateStudentAttemptWithTotalAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional){
        if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();

        Long timeElapsedInSeconds = attemptDataParserService.getTimeElapsedInSecondsFromAttemptData(attemptData);

        double totalMarks = calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(studentAttemptOptional);

        StudentAttempt attempt = studentAttemptOptional.get();
        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);

        return studentAttemptRepository.save(attempt);

    }


    @Transactional
    public Double calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(Optional<StudentAttempt> studentAttemptOptional)  {
        try{
            if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");
            if(Objects.isNull(studentAttemptOptional.get().getAttemptData())) throw new VacademyException("Attempt Data Not Found");

            return calculateTotalMarks(studentAttemptOptional);
        }
        catch (Exception e){
            throw new VacademyException("Failed to calculate marks: " +e.getMessage());
        }
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
    public double calculateTotalMarks(Optional<StudentAttempt> studentAttemptOptional) throws Exception {
        double totalMarks = 0.0;

        if (studentAttemptOptional.isEmpty()) {
            return 0.0;
        }

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        Assessment assessment = studentAttempt.getRegistration().getAssessment();
        String attemptData = studentAttempt.getAttemptData();

        List<String> sectionList = attemptDataParserService.extractSectionJsonStrings(attemptData);

        for (String section : sectionList) {
            totalMarks += calculateMarksForSection(section, attemptData, assessment, studentAttempt);
        }

        return totalMarks;
    }

    private double calculateMarksForSection(String sectionJson, String attemptData, Assessment assessment, StudentAttempt studentAttempt) {
        double sectionMarks = 0.0;
        List<String> questionJsons = attemptDataParserService.extractQuestionJsonsFromSection(sectionJson);

        for (String question : questionJsons) {
            sectionMarks += calculateMarksForQuestion(sectionJson, question, attemptData, assessment, studentAttempt);
        }

        return sectionMarks;
    }

    private double calculateMarksForQuestion(String sectionJson, String questionJson, String attemptData, Assessment assessment, StudentAttempt studentAttempt) {
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
        String questionWiseResponseData = getQuestionDetails(questionId, attemptData);

        QuestionWiseBasicDetailDto questionWiseBasicDetailDto = QuestionBasedStrategyFactory.calculateMarks(
                markingScheme.getMarkingJson(),
                questionAsked.getAutoEvaluationJson(),
                questionWiseResponseData,
                type
        );
        double marksObtained = questionWiseBasicDetailDto.getMarks();
        String answerStatus = questionWiseBasicDetailDto.getAnswerStatus();

        Optional<Section> sectionOptional = sectionRepository.findById(sectionId);
        if(sectionOptional.isEmpty()) throw new VacademyException("Section Not Found");

        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(
                assessment, studentAttempt, questionAsked, questionWiseResponseData, attemptDataParserService.extractTimeTakenInSecondsFromQuestionJson(questionJson),answerStatus, sectionOptional.get(), marksObtained
        );

        return marksObtained;
    }

    public LearnerAssessmentAttemptDataDto validateAndCreateJsonObject(String jsonContent) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(jsonContent, LearnerAssessmentAttemptDataDto.class);
        } catch (Exception e) {
            throw new VacademyException("Invalid json format: " + e.getMessage());
        }
    }

    public LearnerManualAttemptDataDto validateAndCreateManualAttemptJsonObject(String jsonContent) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(jsonContent, LearnerManualAttemptDataDto.class);
        } catch (Exception e) {
            throw new VacademyException("Invalid json format: " + e.getMessage());
        }
    }

    public String getQuestionDetails(String questionId, String attemptDataJson) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode rootNode = objectMapper.readTree(attemptDataJson);

            // Iterate over the sections array
            JsonNode sections = rootNode.path(AttemptJsonConstants.sections);
            for (JsonNode section : sections) {
                JsonNode questions = section.path(AttemptJsonConstants.questions);

                // Iterate over the questions in the current section
                for (JsonNode question : questions) {
                    // Compare question_id to find the correct question
                    if (question.path(AttemptJsonConstants.questionId).asText().equals(questionId)) {
                        return objectMapper.writeValueAsString(question); // Return question as JSON string
                    }
                }
            }
            return "{}"; // Return empty JSON if questionId not found
        } catch (Exception e) {
            return "{}"; // Return empty JSON in case of error
        }
    }

    public List<StudentAttempt> getAllParticipantsAttemptForAssessment(String assessmentId){
        return studentAttemptRepository.findAllParticipantsFromAssessmentAndStatusNotIn(assessmentId, List.of("DELETED"));
    }

    public void revaluateForAllParticipants(String assessmentId) {
        List<StudentAttempt> allAttempts = studentAttemptRepository.findAllParticipantsFromAssessmentAndStatusNotIn(assessmentId, List.of("DELETED"));
        revaluateAssessmentForAttempts(allAttempts);
    }

    public void revaluateAssessmentForAttempts(List<StudentAttempt> allAttempts){
        allAttempts.forEach(attempt -> {
            if(attempt.getStatus().equals("ENDED")){
                updateStudentAttemptWithResultAfterMarksCalculation(Optional.of(attempt));
            }
            else if(attempt.getStatus().equals("LIVE")){
                updateStudentAttemptWithTotalAfterMarksCalculation(Optional.of(attempt));
            }

        });
    }

    public void revaluateForCustomParticipantsAndQuestions(Assessment assessment, RevaluateRequest request){
        List<StudentAttempt> allAttempts = StreamSupport
                .stream(studentAttemptRepository.findAllById(request.getAttemptIds()).spliterator(), false)
                .toList();

        List<RevaluateRequest.RevaluateQuestionDto> questionDtos = request.getQuestions();
        questionDtos.forEach(question->{
            String sectionId = question.getSectionId();
            List<String> questionIds = question.getQuestionIds();

            for (StudentAttempt attempt : allAttempts) {
                calculateMarksForSectionIdAndQuestionIds(Optional.of(attempt), sectionId, questionIds,assessment);
                updateMarksAfterRevaluation(attempt, assessment.getId());
            }
        });
    }

    @Async
    public CompletableFuture<Void> revaluateForAllParticipantsWrapper(Assessment assessment, String instituteId) {
        return CompletableFuture.runAsync(() -> revaluateForAllParticipants(assessment.getId()))
                .thenRun(() -> sendEmail(instituteId,assessment));
    }

    @Async
    public CompletableFuture<Void> revaluateForParticipantIdsWrapper(Assessment assessment, List<String> allAttemptIds, String instituteId) {
        List<StudentAttempt> allAttempts = StreamSupport
                .stream(studentAttemptRepository.findAllById(allAttemptIds).spliterator(), false)
                .toList();

        return CompletableFuture.runAsync(() -> revaluateAssessmentForAttempts(allAttempts))
                .thenRun(() -> sendEmail(instituteId,assessment));
    }

    @Async
    public CompletableFuture<Void> revaluateCustomParticipantAndQuestionsWrapper(Assessment assessment, RevaluateRequest request, String instituteId) {

        return CompletableFuture.runAsync(() -> revaluateForCustomParticipantsAndQuestions(assessment, request))
                .thenRun(() -> sendEmail(instituteId,assessment));
    }


    public void updateMarksAfterRevaluation(StudentAttempt studentAttempt, String assessmentId){
        List<QuestionWiseMarks> allQuestionWiseMarks = questionWiseMarksService.getAllQuestionWiseMarksForAttemptId(studentAttempt.getId(), assessmentId);
        double totalMarks = 0.0;

        for(QuestionWiseMarks questionWiseMarks: allQuestionWiseMarks){
            totalMarks+=questionWiseMarks.getMarks();
        }

        studentAttempt.setTotalMarks(totalMarks);
        if(studentAttempt.getStatus().equals("ENDED")){
            studentAttempt.setResultMarks(totalMarks);
        }

        studentAttemptRepository.save(studentAttempt);
    }

    public void calculateMarksForSectionIdAndQuestionIds(Optional<StudentAttempt> studentAttemptOptional, String sectionId, List<String> questionIds, Assessment assessment){
        questionIds.forEach(questionId->{
            calculateMarksForSectionIdAndQuestionId(studentAttemptOptional,sectionId,questionId,assessment);
        });
    }


    public double calculateMarksForSectionIdAndQuestionId(Optional<StudentAttempt> studentAttemptOptional, String sectionId, String questionId, Assessment assessment){
        if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        String jsonAttemptData = studentAttempt.getAttemptData();
        if(Objects.isNull(jsonAttemptData)) return 0.0;

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
                assessment, studentAttempt, questionAsked, questionWiseResponseData, null,answerStatus, section, marksObtained
        );

        return marksObtained;
    }


    private void sendEmail(String instituteId,Assessment assessment) {
       assessmentNotificationService.sendNotificationsToAdminsAfterReevaluating(assessment, instituteId);
    }

    public Optional<StudentAttempt> getStudentAttemptById(String id){
        return studentAttemptRepository.findById(id);
    }

    public Page<ManualAttemptResponseDto> getAllManualAssignedAttempt(String userId, String assessmentId, String instituteId,String name, List<String> evaluationStatus, Pageable pageable) {
        if(Objects.isNull(evaluationStatus)) evaluationStatus = new ArrayList<>();
        return studentAttemptRepository.findAllAssignedAttemptForUserIdWithFilter(userId,instituteId,assessmentId,name,evaluationStatus, pageable);
    }
}
