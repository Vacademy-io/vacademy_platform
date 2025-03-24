package vacademy.io.assessment_service.features.question_bank.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionDTO;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.dto.AddedQuestionPaperResponseDto;
import vacademy.io.assessment_service.features.question_bank.dto.EditQuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_core.dto.*;
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.enums.EvaluationTypes;
import vacademy.io.assessment_service.features.question_core.enums.QuestionAccessLevel;
import vacademy.io.assessment_service.features.question_core.enums.QuestionResponseTypes;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;
import vacademy.io.assessment_service.features.question_core.repository.OptionRepository;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus.DELETED;

@Component
public class AddQuestionPaperFromImportManager {

    @Autowired
    QuestionRepository questionRepository;

    @Autowired
    OptionRepository optionRepository;

    @Autowired
    QuestionPaperRepository questionPaperRepository;
    @Autowired
    QuestionEvaluationService questionEvaluationService;

    @Transactional
    public AddedQuestionPaperResponseDto addQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody, Boolean isPublicPaper) throws JsonProcessingException {

        QuestionPaper questionPaper = new QuestionPaper();
        questionPaper.setTitle(questionRequestBody.getTitle());
        questionPaper.setCreatedByUserId(user.getUserId());

        if (isPublicPaper)
            questionPaper.setAccess(QuestionAccessLevel.PUBLIC.name());
        else
            questionPaper.setAccess(QuestionAccessLevel.PRIVATE.name());

        questionPaper = questionPaperRepository.save(questionPaper);

        List<Question> questions = new ArrayList<>();
        List<Option> options = new ArrayList<>();
        for (int i = 0; i < questionRequestBody.getQuestions().size(); i++) {
            Question question = makeQuestionAndOptionFromImportQuestion(questionRequestBody.getQuestions().get(i), isPublicPaper, null);

            options.addAll(question.getOptions());
            if (questionRequestBody.getQuestions().get(i).getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(questionRequestBody.getQuestions().get(i).getParentRichText()));
            }
            questions.add(question);
        }


        questions = questionRepository.saveAll(questions);
        options = optionRepository.saveAll(options);

        List<String> savedQuestionIds = questions.stream().map(Question::getId).toList();

        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), savedQuestionIds);

        if (!isPublicPaper)
            questionPaperRepository.linkInstituteToQuestionPaper(UUID.randomUUID().toString(), questionPaper.getId(), questionRequestBody.getInstituteId(), "ACTIVE", questionRequestBody.getLevelId(), questionRequestBody.getSubjectId());

        return new AddedQuestionPaperResponseDto(questionPaper.getId());

    }

    @Transactional
    public Boolean updateQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody, Boolean isPublicPaper) throws JsonProcessingException {

        // Fetch the existing question paper by ID
        QuestionPaper questionPaper = questionPaperRepository.findById(questionRequestBody.getId())
                .orElseThrow(() -> new EntityNotFoundException("Question Paper not found"));

        // Update title only if it's not null
        if (questionRequestBody.getTitle() != null) {
            questionPaper.setTitle(questionRequestBody.getTitle());
        }

        // Update createdBy and access level
        questionPaper.setCreatedByUserId(user.getUserId());
        questionPaper.setAccess(isPublicPaper ? QuestionAccessLevel.PUBLIC.name() : QuestionAccessLevel.PRIVATE.name());

        // Save updated question paper
        questionPaper = questionPaperRepository.save(questionPaper);

        // Process and insert new questions directly (no need to check for duplicates)
        List<Question> newQuestions = new ArrayList<>();
        List<Option> newOptions = new ArrayList<>();

        for (var importQuestion : questionRequestBody.getQuestions()) {
            Question question = makeQuestionAndOptionFromImportQuestion(importQuestion, isPublicPaper, null);
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            newQuestions.add(question);
            newOptions.addAll(question.getOptions());
        }

        // Save new questions and options
        if (!newQuestions.isEmpty()) {
            newQuestions = questionRepository.saveAll(newQuestions);
            newOptions = optionRepository.saveAll(newOptions);

            // Get the IDs of newly added questions
            List<String> newQuestionIds = newQuestions.stream().map(Question::getId).toList();

            // Associate new questions with the existing question paper
            questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), newQuestionIds);
        }

        // If not public, link to an institute
        if (!isPublicPaper) {
            questionPaperRepository.linkInstituteToQuestionPaper(
                    UUID.randomUUID().toString(), questionPaper.getId(),
                    questionRequestBody.getInstituteId(), "ACTIVE",
                    questionRequestBody.getLevelId(), questionRequestBody.getSubjectId()
            );
        }

        return true;
    }


    public Question makeQuestionAndOptionFromImportQuestion(QuestionDTO questionRequest, Boolean isPublic, Question existingQuestion) throws JsonProcessingException {
        // Todo: check Question Validation

        Question question = initializeQuestion(questionRequest, existingQuestion);

        List<Option> options = new ArrayList<>();
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
                handleOneWordQuestion(question , questionRequest);
                break;
            case LONG_ANSWER:
                handleLongAnswerQuestion(question , questionRequest);
                break;
            default:
                throw new IllegalArgumentException("Unsupported question type: " + questionRequest.getQuestionType());
        }

        setQuestionMetadata(question, questionRequest, isPublic, question.getOptions());
        return question;

    }

    public Boolean editQuestionPaper(CustomUserDetails user, EditQuestionPaperDTO questionRequestBody) throws JsonProcessingException {
        Optional<QuestionPaper> questionPaper = questionPaperRepository.findById(questionRequestBody.getId());

        if (questionPaper.isEmpty())
            return false;

        // Update title only if it's not null
        if (questionRequestBody.getTitle() != null) {
            questionPaper.get().setTitle(questionRequestBody.getTitle());
        }

        // Update createdBy and access level
        questionPaper.get().setCreatedByUserId(user.getUserId());

        // Save updated question paper
        questionPaper = Optional.of(questionPaperRepository.save(questionPaper.get()));

        // Process and insert new questions directly (no need to check for duplicates)
        List<Question> newQuestions = new ArrayList<>();
        List<Option> newOptions = new ArrayList<>();

        for (var importQuestion : questionRequestBody.getAddedQuestions()) {
            Question question = makeQuestionAndOptionFromImportQuestion(importQuestion, false, null);
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            newQuestions.add(question);
            newOptions.addAll(question.getOptions());
        }

        for (var importQuestion : questionRequestBody.getUpdatedQuestions()) {
            Optional<Question> existingQuestion = questionRepository.findById(importQuestion.getId());

            if (existingQuestion.isEmpty())
                continue;
            Question question = makeQuestionAndOptionFromImportQuestion(importQuestion, false, existingQuestion.get());
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            newQuestions.add(question);
            newOptions.addAll(question.getOptions());
        }

        for (var importQuestion : questionRequestBody.getDeletedQuestions()) {
            Optional<Question> existingQuestion = questionRepository.findById(importQuestion.getId());

            if (existingQuestion.isEmpty())
                continue;
            existingQuestion.get().setStatus(DELETED.name());
        }

        questionRepository.saveAll(newQuestions);
        optionRepository.saveAll(newOptions);

        return true;
    }

    public AddQuestionDTO addPrivateQuestions(CustomUserDetails user, AddQuestionDTO questionRequestBody, boolean isPublicQuestion) throws JsonProcessingException {

        List<Option> options = new ArrayList<>();
        for (int i = 0; i < questionRequestBody.getQuestions().size(); i++) {
            Question question = makeQuestionAndOptionFromImportQuestion(questionRequestBody.getQuestions().get(i), isPublicQuestion, null);
            options.addAll(question.getOptions());
            question = questionRepository.save(question);
            questionRequestBody.getQuestions().get(i).setId(question.getId());
            options = optionRepository.saveAll(options);
            options.clear();
        }

        return questionRequestBody;
    }

    private Question initializeQuestion(QuestionDTO questionRequest, Question existingQuestion) {
        Question question = new Question();
        if(existingQuestion != null) {
            question = existingQuestion;
        }

        question.setTextData(AssessmentRichTextData.fromDTO(questionRequest.getText()));
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

            if (requestEvaluation.getData().getCorrectOptionIds().contains(String.valueOf(optionDTO.getPreviewId()))) {
                correctOptionIds.add(optionId.toString());
            }
            options.add(option);
        }
        question.setOptions(options);
        return correctOptionIds;
    }

    private void handleNumericQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        NumericalEvaluationDto requestNumericalEvaluation = (NumericalEvaluationDto) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), NumericalEvaluationDto.class);

        NumericalEvaluationDto numericalEvaluation = new NumericalEvaluationDto();
        numericalEvaluation.setType(QuestionTypes.NUMERIC.name());
        numericalEvaluation.setData(new NumericalEvaluationDto.NumericalData(requestNumericalEvaluation.getData().getValidAnswers()));

        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(numericalEvaluation));
        question.setOptionsJson(questionRequest.getOptionsJson());
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else question.setQuestionResponseType(QuestionResponseTypes.INTEGER.name());
    }

    private void handleOneWordQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        OneWordEvaluationDTO requestOneWordEvaluation = (OneWordEvaluationDTO) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), OneWordEvaluationDTO.class);

        OneWordEvaluationDTO oneWordEvaluation = new OneWordEvaluationDTO();
        oneWordEvaluation.setType(QuestionTypes.ONE_WORD.name());
        oneWordEvaluation.setData(new OneWordEvaluationDTO.OneWordEvaluationData(requestOneWordEvaluation.getData().getAnswer()));

        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(oneWordEvaluation));
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else question.setQuestionResponseType(QuestionResponseTypes.ONE_WORD.name());
    }

    private void handleLongAnswerQuestion(Question question, QuestionDTO questionRequest) throws JsonProcessingException {
        LongAnswerEvaluationDTO requestLongAnswerEvaluation = (LongAnswerEvaluationDTO) questionEvaluationService.getEvaluationJson(
                questionRequest.getAutoEvaluationJson(), LongAnswerEvaluationDTO.class);

        LongAnswerEvaluationDTO longAnswerEvaluation = new LongAnswerEvaluationDTO();
        longAnswerEvaluation.setType(QuestionTypes.LONG_ANSWER.name());
        longAnswerEvaluation.setData(new LongAnswerEvaluationDTO.LongAnswerEvaluationData(requestLongAnswerEvaluation.getData().getAnswer()));

        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(longAnswerEvaluation));
        if (questionRequest.getQuestionResponseType() != null) {
            question.setQuestionResponseType(questionRequest.getQuestionResponseType());
        } else question.setQuestionResponseType(QuestionResponseTypes.LONG_ANSWER.name());
    }


    private void handleMCQQuestion(Question question, QuestionDTO questionRequest, List<Option> options, List<String> correctOptionIds) throws JsonProcessingException {

        MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
        mcqEvaluation.setType(question.getQuestionType());
        mcqEvaluation.setData(new MCQEvaluationDTO.MCQData(correctOptionIds));

        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(mcqEvaluation));
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
