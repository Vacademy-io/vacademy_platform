package vacademy.io.assessment_service.features.question_bank.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_core.dto.MCQEvaluationDTO;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.assessment_service.features.question_core.enums.QuestionResponseTypes;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.assessment_service.features.rich_text.repository.AssessmentRichTextRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class AddQuestionPaperFromImportManager {

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    QuestionPaperRepository questionPaperRepository;

    @Autowired
    QuestionEvaluationService questionEvaluationService;

    @Autowired
    AssessmentRichTextRepository assessmentRichTextRepository;

    
    @Transactional
    public Boolean addQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody) throws JsonProcessingException {

        QuestionPaper questionPaper = new QuestionPaper();
        questionPaper.setTitle(questionRequestBody.getTitle());
        questionPaper.setCreatedByUserId(user.getUserId());
        questionPaper = questionPaperRepository.save(questionPaper);

        List<Question> questions = new ArrayList<>();
        for (int i = 0; i < questionRequestBody.getQuestions().size(); i++) {
            Question question = makeQuestionAndOptionFromImportQuestion(questionRequestBody.getQuestions().get(i));
            question = questionRepository.save(question);
            questions.add(question);
        }
        questions = questionRepository.saveAll(questions);

        List<String> savedQuestionIds = questions.stream().map(Question::getId).toList();
        
        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), savedQuestionIds);
        
        questionPaperRepository.linkInstituteToQuestionPaper(UUID.randomUUID().toString(), questionPaper.getId(), questionRequestBody.getInstituteId(), "ACTIVE");
        
        return true;

    }

    private Question makeQuestionAndOptionFromImportQuestion(QuestionDTO questionRequest) throws JsonProcessingException {
        // Todo: check Question Validation

        Question question = new Question();
        question.setTextData(AssessmentRichTextData.fromDTO(questionRequest.getText()));
        if (questionRequest.getText() != null)
            question.setExplanationTextData(AssessmentRichTextData.fromDTO(questionRequest.getExplanationText()));

        List<Option> options = new ArrayList<>();
        List<String> correctOptionIds = new ArrayList<>();
        MCQEvaluationDTO requestEvaluation =  questionEvaluationService.getEvaluationJson(questionRequest.getAutoEvaluationJson());
        for (int i = 0; i < questionRequest.getOptions().size(); i++) {
            Option option = new Option();
            UUID optionId = UUID.randomUUID();
            option.setId(optionId.toString());
            option.setText(AssessmentRichTextData.fromDTO(questionRequest.getOptions().get(i).getText()));
            if (requestEvaluation.getData().getCorrectOptionIds().contains(String.valueOf(questionRequest.getOptions().get(i).getPreviewId())))
                correctOptionIds.add(optionId.toString());
            options.add(option);
        }
        question.setOptions(options);

        MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
        mcqEvaluation.setType((options.size() > 1) ? QuestionTypes.MCQM.name() : QuestionTypes.MCQS.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();
        mcqData.setCorrectOptionIds(correctOptionIds);
        mcqEvaluation.setData(mcqData);

        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(mcqEvaluation));
        question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());
        question.setQuestionType((options.size() > 1) ? QuestionTypes.MCQM.name() : QuestionTypes.MCQS.name());
        question.setEvaluationType(EvaluationTypes.AUTO.name());
        return question;
    }

    public Boolean editQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody) {
        Optional<QuestionPaper> questionPaper = questionPaperRepository.findById(questionRequestBody.getId());

        if(questionPaper.isEmpty())
            return false;

        return true;
        // todo : edit question paper

    }
}
