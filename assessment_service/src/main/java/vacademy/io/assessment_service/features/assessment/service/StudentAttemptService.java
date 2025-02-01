package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQMMarkingStrategy;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.MCQSMarkingStrategy;
import vacademy.io.assessment_service.features.assessment.service.marking_strategy.Markingfactory;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.AssessmentJson;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.LearnerAssessmentStatusJson;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.QuestionJson;
import vacademy.io.assessment_service.features.learner_assessment.dto.status_json.SectionJson;
import vacademy.io.assessment_service.features.learner_assessment.service.QuestionWiseMarksService;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

@Service
public class StudentAttemptService {

    @Autowired
    StudentAttemptRepository studentAttemptRepository;

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

    @Autowired
    MCQMMarkingStrategy mcqmMarkingStrategy;

    @Autowired
    MCQSMarkingStrategy mcqsMarkingStrategy;

    @Autowired
    QuestionWiseMarksService questionWiseMarksService;

    public StudentAttempt updateStudentAttempt(StudentAttempt studentAttempt){
        return studentAttemptRepository.save(studentAttempt);
    }

    public StudentAttempt updateLeaderBoard(StudentAttempt studentAttempt){
        return updateStudentAttempt(studentAttempt);
    }


    public StudentAttempt updateStudentAttemptWithTotalAfterMarksCalculation(Optional<StudentAttempt> studentAttemptOptional){
        if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");

        String attemptData = studentAttemptOptional.get().getAttemptData();
        LearnerAssessmentStatusJson attemptDataObject = validateAndCreateJsonObject(attemptData);

        Long timeElapsedInSeconds = attemptDataObject.getAssessment().getTimeElapsedInSeconds();

        double totalMarks = calculateTotalMarksForAttemptAndUpdateAttemptData(studentAttemptOptional, attemptDataObject);

        StudentAttempt attempt = studentAttemptOptional.get();
        attempt.setTotalMarks(totalMarks);
        attempt.setTotalTimeInSeconds(timeElapsedInSeconds);

        return studentAttemptRepository.save(attempt);

    }


    @Transactional
    public Double calculateTotalMarksForAttemptAndUpdateAttemptData(Optional<StudentAttempt> studentAttemptOptional, LearnerAssessmentStatusJson attemptDataObject)  {
        try{
            if(studentAttemptOptional.isEmpty()) throw new VacademyException("Student Attempt Not Found");
            if(Objects.isNull(studentAttemptOptional.get().getAttemptData())) throw new VacademyException("Attempt Data Not Found");

            return calculateTotalMarks(attemptDataObject, studentAttemptOptional);
        }
        catch (Exception e){
            throw new VacademyException("Failed to calculate marks: " +e.getMessage());
        }
    }

    public double calculateTotalMarks(LearnerAssessmentStatusJson learnerAssessmentData, Optional<StudentAttempt> studentAttemptOptional) throws Exception {
        double totalMarks = 0;
        String assessmentId = learnerAssessmentData.getAssessment().getAssessmentId();
        String attemptId = learnerAssessmentData.getAttemptId();


        if(studentAttemptOptional.isEmpty() || !attemptId.equals(studentAttemptOptional.get().getId())) return 0.0;
        Assessment assessment = studentAttemptOptional.get().getRegistration().getAssessment();
        String attemptData = studentAttemptOptional.get().getAttemptData();

        // Iterate over sections
        for (SectionJson section : learnerAssessmentData.getSections()) {
            // Iterate over questions within each section
            for (QuestionJson question : section.getQuestions()) {
                // Get the marking strategy based on the question type
                String sectionId = section.getSectionId();
                String questionId = question.getQuestionId();
                QuestionJson.OptionsJson responseData = question.getResponseData();
                List<String> attemptedOptionIds = responseData!=null ? responseData.getOptionIds() : new ArrayList<>();
                String type = responseData != null ? responseData.getType() : "";

                Long timeTakenInSeconds = question.getTimeTakenInSeconds();

                Optional<QuestionAssessmentSectionMapping> questionAssessmentSectionMapping = questionAssessmentSectionMappingRepository.findByQuestionIdAndSectionId(questionId, sectionId);
                if(questionAssessmentSectionMapping.isEmpty()) return totalMarks;
                QuestionAssessmentSectionMapping markingScheme = questionAssessmentSectionMapping.get();
                Question questionAsked = markingScheme.getQuestion();

                String questionWiseResponseData = getQuestionDetails(questionId, attemptData);


                switch (type){
                    case "MCQM" ->{
                        IMarkingStrategy strategy = Markingfactory.getMarkingStrategy("MCQM");
                        double marks = strategy.calculateMarks(markingScheme.getMarkingJson(), questionAsked.getAutoEvaluationJson(), attemptedOptionIds);
                        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(assessment, studentAttemptOptional.get(),questionAsked,"", timeTakenInSeconds,marks);
                        totalMarks+=marks;
                    }

                    case "MCQS" ->{
                        IMarkingStrategy strategy = Markingfactory.getMarkingStrategy("MCQS");
                        double marks = strategy.calculateMarks(markingScheme.getMarkingJson(), questionAsked.getAutoEvaluationJson(), attemptedOptionIds);
                        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(assessment, studentAttemptOptional.get(),questionAsked,"", timeTakenInSeconds,marks);
                        totalMarks+=marks;
                    }
                    default ->{
                        double marks = 0;
                        questionWiseMarksService.updateQuestionWiseMarksForEveryQuestion(assessment, studentAttemptOptional.get(),questionAsked,"", timeTakenInSeconds,marks);
                    }
                }

            }
        }
        return totalMarks;
    }

    public LearnerAssessmentStatusJson validateAndCreateJsonObject(String jsonContent) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(jsonContent, LearnerAssessmentStatusJson.class);
        } catch (Exception e) {
            throw new VacademyException("Invalid json format: " + e.getMessage());
        }
    }

    public static String getQuestionDetails(String questionId, String attemptDataJson) {
        try{
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode rootNode = objectMapper.readTree(attemptDataJson);

            JsonNode questions = rootNode.path("sections").path("questions");

            for (JsonNode question : questions) {
                if (question.path("question_id").asText().equals(questionId)) {
                    return objectMapper.writeValueAsString(question);
                }
            }
            return "{}"; // Return empty JSON if questionId not found
        }
        catch (Exception e){
            return "{}";
        }
    }



}
