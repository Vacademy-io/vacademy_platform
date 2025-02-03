package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.flogger.Flogger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQMQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQSQuestionTypeBasedStrategy;
import vacademy.io.assessment_service.features.learner_assessment.constants.AttemptJsonConstants;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentAttemptDataDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionAttemptData;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.SectionAttemptData;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class StudentAttemptService {

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

    @Autowired
    MCQMQuestionTypeBasedStrategy mcqmMarkingStrategy;

    @Autowired
    MCQSQuestionTypeBasedStrategy mcqsMarkingStrategy;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

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


    public StudentAttempt updateStudentAttemptWithTotalAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional){
        if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();
        LearnerAssessmentAttemptDataDto attemptDataObject = validateAndCreateJsonObject(attemptData);

        Long timeElapsedInSeconds = attemptDataObject.getAssessment().getTimeElapsedInSeconds();

        double totalMarks = calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(studentAttemptOptional, attemptDataObject);

        StudentAttempt attempt = studentAttemptOptional.get();
        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);

        return studentAttemptRepository.save(attempt);

    }


    @Transactional
    public Double calculateTotalMarksForAttemptAndUpdateQuestionWiseMarks(Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentAttemptDataDto attemptDataObject)  {
        try{
            if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");
            if(Objects.isNull(studentAttemptOptional.get().getAttemptData())) throw new VacademyException("Attempt Data Not Found");

            return calculateTotalMarks(attemptDataObject, studentAttemptOptional);
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
     * @param learnerAssessmentData - The learner's assessment data containing sections and responses.
     * @param studentAttemptOptional - The student's attempt details, wrapped in an Optional.
     * @return The total marks for the learner's attempt.
     * @throws Exception - If any error occurs during the calculation.
     */
    public double calculateTotalMarks(LearnerAssessmentAttemptDataDto learnerAssessmentData, Optional<StudentAttempt> studentAttemptOptional) throws Exception {
        double totalMarks = 0.0;

        if (studentAttemptOptional.isEmpty() || !learnerAssessmentData.getAttemptId().equals(studentAttemptOptional.get().getId())) {
            return 0.0;
        }

        StudentAttempt studentAttempt = studentAttemptOptional.get();
        Assessment assessment = studentAttempt.getRegistration().getAssessment();
        String attemptData = studentAttempt.getAttemptData();

        for (SectionAttemptData section : learnerAssessmentData.getSections()) {
            totalMarks += calculateMarksForSection(section, attemptData, assessment, studentAttempt);
        }

        return totalMarks;
    }

    private double calculateMarksForSection(SectionAttemptData section, String attemptData, Assessment assessment, StudentAttempt studentAttempt) {
        double sectionMarks = 0.0;

        for (QuestionAttemptData question : section.getQuestions()) {
            sectionMarks += calculateMarksForQuestion(section, question, attemptData, assessment, studentAttempt);
        }

        return sectionMarks;
    }

    private double calculateMarksForQuestion(SectionAttemptData section, QuestionAttemptData question, String attemptData, Assessment assessment, StudentAttempt studentAttempt) {
        String sectionId = section.getSectionId() != null ? section.getSectionId() : "";
        String questionId = question.getQuestionId() != null ? question.getQuestionId() : "";
        QuestionAttemptData.OptionsJson responseData = question.getResponseData();
        String type = responseData != null ? responseData.getType() : "";

        Optional<QuestionAssessmentSectionMapping> questionAssessmentSectionMapping =
                questionAssessmentSectionMappingRepository.findByQuestionIdAndSectionId(questionId, sectionId);

        if (questionAssessmentSectionMapping.isEmpty()) {
            return 0.0;
        }

        QuestionAssessmentSectionMapping markingScheme = questionAssessmentSectionMapping.get();
        Question questionAsked = markingScheme.getQuestion();
        String questionWiseResponseData = getQuestionDetails(questionId, attemptData);

        double marksObtained = QuestionBasedStrategyFactory.calculateMarks(
                markingScheme.getMarkingJson(),
                questionAsked.getAutoEvaluationJson(),
                questionWiseResponseData,
                type
        );

        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(
                assessment, studentAttempt, questionAsked, questionWiseResponseData, question.getTimeTakenInSeconds(), marksObtained
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

    public static String getQuestionDetails(String questionId, String attemptDataJson) {
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




}
