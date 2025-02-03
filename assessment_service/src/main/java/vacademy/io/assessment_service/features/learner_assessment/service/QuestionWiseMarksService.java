package vacademy.io.assessment_service.features.learner_assessment.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

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
                                                                     double marks){

        Optional<QuestionWiseMarks> questionWiseMarksOpt = questionWiseMarksRepository.findByAssessmentIdAndStudentAttemptIdAndQuestionId(assessment.getId(), attempt.getId(), question.getId());

        if(questionWiseMarksOpt.isPresent()){
            QuestionWiseMarks questionWiseMarks = questionWiseMarksOpt.get();
            questionWiseMarks.setTimeTakenInSeconds(timeTakenInSecs);
            questionWiseMarks.setResponseJson(responseJson);
            questionWiseMarks.setMarks(marks);

            return questionWiseMarksRepository.save(questionWiseMarks);
        }

        QuestionWiseMarks questionWiseMarks = QuestionWiseMarks.builder()
                .assessment(assessment)
                .studentAttempt(attempt)
                .question(question)
                .timeTakenInSeconds(timeTakenInSecs)
                .responseJson(responseJson)
                .marks(marks).build();


        return questionWiseMarksRepository.save(questionWiseMarks);


    }
}
