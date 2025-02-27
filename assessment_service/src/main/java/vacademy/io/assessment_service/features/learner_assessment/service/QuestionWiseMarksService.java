package vacademy.io.assessment_service.features.learner_assessment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.Top3CorrectResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.learner_assessment.dto.QuestionStatusDto;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class QuestionWiseMarksService {

    @Autowired
    QuestionWiseMarksRepository questionWiseMarksRepository;


    public QuestionWiseMarks updateQuestionWiseMarksForEveryQuestion(Assessment assessment,
                                                                     StudentAttempt attempt,
                                                                     Question question,
                                                                     String responseJson,
                                                                     Long timeTakenInSecs,
                                                                     String answerStatus,
                                                                     Section section,
                                                                     double marks){

        Optional<QuestionWiseMarks> questionWiseMarksOpt = questionWiseMarksRepository.findByAssessmentIdAndStudentAttemptIdAndQuestionIdAndSectionId(assessment.getId(), attempt.getId(), question.getId(), section.getId());

        if(questionWiseMarksOpt.isPresent()){
            QuestionWiseMarks questionWiseMarks = questionWiseMarksOpt.get();
            if(!Objects.isNull(timeTakenInSecs)){
                questionWiseMarks.setTimeTakenInSeconds(timeTakenInSecs);
            }
            if(!Objects.isNull(responseJson)){
                questionWiseMarks.setResponseJson(responseJson);
            }

            questionWiseMarks.setMarks(marks);

            questionWiseMarks.setSection(section);
            questionWiseMarks.setStatus(answerStatus);

            return questionWiseMarksRepository.save(questionWiseMarks);
        }

        QuestionWiseMarks questionWiseMarks = QuestionWiseMarks.builder()
                .assessment(assessment)
                .studentAttempt(attempt)
                .question(question)
                .timeTakenInSeconds(timeTakenInSecs)
                .responseJson(responseJson)
                .section(section)
                .marks(marks).build();


        return questionWiseMarksRepository.save(questionWiseMarks);


    }

    public QuestionStatusDto getQuestionStatusForAssessmentAndQuestion(String assessmentId, String questionId, String sectionId){
        return questionWiseMarksRepository.findQuestionStatusAssessmentIdAndQuestionId(assessmentId, questionId, sectionId);
    }

    public List<Top3CorrectResponseDto> getTop3ParticipantsForCorrectResponse(String assessmentId, String questionId, String sectionId){
        return questionWiseMarksRepository.findTop3ParticipantsForCorrectResponse(assessmentId, questionId, sectionId);
    }

    public List<QuestionWiseMarks> getAllQuestionWiseMarksForQuestionIdsAndAttemptId(String attemptId, List<String> questionIds, String sectionId){
        return questionWiseMarksRepository.findAllQuestionWiseMarksForQuestionIdAndAttemptId(questionIds, attemptId, sectionId);
    }

    public List<QuestionWiseMarks> getAllQuestionWiseMarksForAttemptId(String attemptId, String assessmentId){
        return questionWiseMarksRepository.findByStudentAttemptIdAndAssessmentId(attemptId, assessmentId);
    }
}
