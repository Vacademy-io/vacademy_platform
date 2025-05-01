package vacademy.io.community_service.feature.presentation.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.presentation.dto.question.*;
import vacademy.io.community_service.feature.presentation.entity.question.Option;
import vacademy.io.community_service.feature.presentation.entity.question.Question;
import vacademy.io.community_service.feature.presentation.enums.question.EvaluationTypes;
import vacademy.io.community_service.feature.presentation.enums.question.QuestionAccessLevel;
import vacademy.io.community_service.feature.presentation.enums.question.QuestionResponseTypes;
import vacademy.io.community_service.feature.presentation.enums.question.QuestionTypes;
import vacademy.io.community_service.feature.presentation.repository.OptionRepository;
import vacademy.io.community_service.feature.presentation.repository.QuestionRepository;
import vacademy.io.community_service.feature.rich_text.entity.AssessmentRichTextData;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class AddQuestionManager {

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    OptionRepository optionRepository;

    @Autowired
    QuestionEvaluationService questionEvaluationService;


    public Question makeQuestionAndOptionFromImportQuestion(QuestionDTO questionRequest, Boolean isPublic, Question existingQuestion) throws JsonProcessingException {        // Todo: check Question Validation

        Question question = initializeQuestion(questionRequest, existingQuestion);
        List<String> correctOptionIds = new ArrayList<>();

        switch (QuestionTypes.valueOf(questionRequest.getQuestionType())) {
            case NUMERIC:
                handleNumericQuestion(question, questionRequest);
                break;
            case MCQS:
            case MCQM:
                correctOptionIds = createOptions(question, questionRequest);
                handleMCQQuestion(question, questionRequest, question.getOptions(), correctOptionIds);
                break;
            case ONE_WORD:
                handleOneWordQuestion(question, questionRequest);
                break;
            case LONG_ANSWER:
                handleLongAnswerQuestion(question, questionRequest);
                break;
            default:
                throw new IllegalArgumentException("Unsupported question type: " + questionRequest.getQuestionType());
        }

        setQuestionMetadata(question, questionRequest, isPublic, question.getOptions());
        return question;

    }


    public List<Question> addQuestions(List<QuestionDTO> questions) {
        List<Question> newQuestions = new ArrayList<>();
        List<Option> newOptions = new ArrayList<>();
        for (var importQuestion : questions) {
            if (importQuestion.getId() != null)
                continue;
            Question question = null;
            try {
                question = makeQuestionAndOptionFromImportQuestion(importQuestion, false, null);
            } catch (JsonProcessingException e) {
                throw new VacademyException(e.getMessage());
            }
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            newQuestions.add(question);
            List<Option> questionOptions = question.getOptions();
            newOptions.addAll(questionOptions);
        }
        List<Question> savedQuestions = questionRepository.saveAll(newQuestions);
        optionRepository.saveAll(newOptions);

        return savedQuestions;
    }

    public List<Question> saveEditQuestions(List<QuestionDTO> questions) {
        List<Question> newQuestions = new ArrayList<>();
        List<Option> newOptions = new ArrayList<>();
        for (var importQuestion : questions) {
            Question question = null;
            try {
                question = makeQuestionAndOptionFromImportQuestion(importQuestion, false, null);
            } catch (JsonProcessingException e) {
                throw new VacademyException(e.getMessage());
            }
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            newQuestions.add(question);
            List<Option> questionOptions = question.getOptions();
            newOptions.addAll(questionOptions);
        }
        List<Question> savedQuestions = questionRepository.saveAll(newQuestions);
        optionRepository.saveAll(newOptions);

        return savedQuestions;
    }

    private Question initializeQuestion(QuestionDTO questionRequest, Question existingQuestion) {
        Question question = new Question();

        if (existingQuestion != null) {
            question = existingQuestion;
        }
        if (questionRequest.getParentRichText() != null) {
            question.setParentRichText(AssessmentRichTextData.fromDTO(questionRequest.getParentRichText()));
        }
        if (questionRequest.getText() != null) {
            question.setTextData(AssessmentRichTextData.fromDTO(questionRequest.getText()));
        }
        if (questionRequest.getExplanationText() != null) {
            question.setExplanationTextData(AssessmentRichTextData.fromDTO(questionRequest.getExplanationText()));
        }
        question.setQuestionType(questionRequest.getQuestionType());
        switch (questionRequest.getQuestionType()) {
            case "NUMERIC":
                question.setQuestionResponseType(QuestionResponseTypes.INTEGER.name());
                break;
            case "MCQS":
            case "MCQM":
                question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());
                break;
            case "ONE_WORD":
                question.setQuestionResponseType(QuestionResponseTypes.ONE_WORD.name());
            case "LONG_ANSWER":
                question.setQuestionResponseType(QuestionResponseTypes.LONG_ANSWER.name());
            default:
                break;
        }
        return question;
    }

    private List<String> createOptions(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        List<Option> options = new ArrayList<>();
        MCQEvaluationDTO requestEvaluation = (MCQEvaluationDTO) questionEvaluationService.getEvaluationJson(questionRequest.getAutoEvaluationJson(), MCQEvaluationDTO.class);
        List<String> correctOptionIds = new ArrayList<>();
        for (OptionDTO optionDTO : questionRequest.getOptions()) {
            Option option = new Option();
            UUID optionId = UUID.randomUUID();
            option.setId(optionId.toString());
            option.setText(AssessmentRichTextData.fromDTO(optionDTO.getText()));
            option.setQuestion(question);
            option.setMediaId(optionDTO.getMediaId());

            if (requestEvaluation.getData().getCorrectOptionIds().contains(String.valueOf(optionDTO.getPreviewId()))) {
                correctOptionIds.add(optionId.toString());
            }
            options.add(option);
        }
        question.setOptions(new ArrayList<>());
        question.setOptions(options);
        return correctOptionIds;
    }


    private void handleNumericQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        // Retrieve the numerical evaluation from the request
        NumericalEvaluationDto requestNumericalEvaluation = (NumericalEvaluationDto) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), NumericalEvaluationDto.class);

        // Create a new NumericalEvaluationDto object
        NumericalEvaluationDto numericalEvaluation = new NumericalEvaluationDto();
        numericalEvaluation.setType(QuestionTypes.NUMERIC.name());

        // Check if valid answers are not null before setting them
        if (requestNumericalEvaluation.getData() != null && requestNumericalEvaluation.getData().getValidAnswers() != null) {
            numericalEvaluation.setData(new NumericalEvaluationDto.NumericalData(requestNumericalEvaluation.getData().getValidAnswers()));
        }

        // Set the auto evaluation JSON only if numerical evaluation is not null
        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(numericalEvaluation));

        // Set options JSON only if it's not null
        if (questionRequest.getOptionsJson() != null) {
            question.setOptionsJson(questionRequest.getOptionsJson());
        }

        // Set question response type only if it's not null; otherwise, set a default value
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else {
            question.setQuestionResponseType(QuestionResponseTypes.INTEGER.name());
        }
    }


    private void handleOneWordQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        // Retrieve the one-word evaluation from the request
        OneWordEvaluationDTO requestOneWordEvaluation = (OneWordEvaluationDTO) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), OneWordEvaluationDTO.class);

        // Create a new OneWordEvaluationDTO object
        OneWordEvaluationDTO oneWordEvaluation = new OneWordEvaluationDTO();
        oneWordEvaluation.setType(QuestionTypes.ONE_WORD.name());

        // Check if valid answer is not null before setting it
        if (requestOneWordEvaluation != null && requestOneWordEvaluation.getData() != null
                && requestOneWordEvaluation.getData().getAnswer() != null) {
            oneWordEvaluation.setData(new OneWordEvaluationDTO.OneWordEvaluationData(requestOneWordEvaluation.getData().getAnswer()));
        }

        // Set the auto evaluation JSON only if one-word evaluation is not null
        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(oneWordEvaluation));

        // Set question response type only if it's not null; otherwise, set a default value
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else {
            question.setQuestionResponseType(QuestionResponseTypes.ONE_WORD.name());
        }
    }


    private void handleLongAnswerQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        // Retrieve the long answer evaluation from the request
        LongAnswerEvaluationDTO requestLongAnswerEvaluation = (LongAnswerEvaluationDTO) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), LongAnswerEvaluationDTO.class);

        // Create a new LongAnswerEvaluationDTO object
        LongAnswerEvaluationDTO longAnswerEvaluation = new LongAnswerEvaluationDTO();
        longAnswerEvaluation.setType(QuestionTypes.LONG_ANSWER.name());

        // Check if valid answer is not null before setting it
        if (requestLongAnswerEvaluation != null && requestLongAnswerEvaluation.getData() != null
                && requestLongAnswerEvaluation.getData().getAnswer() != null) {
            longAnswerEvaluation.setData(new LongAnswerEvaluationDTO.LongAnswerEvaluationData(requestLongAnswerEvaluation.getData().getAnswer()));
        }

        // Set the auto evaluation JSON only if long answer evaluation is not null
        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(longAnswerEvaluation));

        // Set question response type only if it's not null; otherwise, set a default value
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else {
            question.setQuestionResponseType(QuestionResponseTypes.LONG_ANSWER.name());
        }
    }


    private void handleMCQQuestion(Question question, QuestionDTO questionRequest, List<Option> options, List<String> correctOptionIds) throws JsonProcessingException {

        MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
        if (question.getQuestionType() != null) mcqEvaluation.setType(question.getQuestionType());
        if (correctOptionIds != null) {
            mcqEvaluation.setData(new MCQEvaluationDTO.MCQData(correctOptionIds));
            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(mcqEvaluation));
        }
    }


    private void setQuestionMetadata(Question question, QuestionDTO questionRequest, Boolean isPublic, List<Option> options) {

        question.setAccessLevel(isPublic ? QuestionAccessLevel.PUBLIC.name() : QuestionAccessLevel.PRIVATE.name());

        question.setEvaluationType(
                (questionRequest.getEvaluationType() != null) ? questionRequest.getEvaluationType() : EvaluationTypes.AUTO.name());

        question.setMediaId(questionRequest.getMediaId());

        question.setQuestionType(questionRequest.getQuestionType());
        question.setExplanationTextData(AssessmentRichTextData.fromDTO(questionRequest.getExplanationText()));
    }


}
