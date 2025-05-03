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
import vacademy.io.assessment_service.features.tags.entities.EntityTag;
import vacademy.io.assessment_service.features.tags.entities.EntityTagsId;
import vacademy.io.assessment_service.features.tags.entities.repository.EntityTagCommunityRepository;
import vacademy.io.assessment_service.features.tags.entities.repository.TagCommunityRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static vacademy.io.assessment_service.features.assessment.enums.AssessmentSetStatusEnum.DELETED;

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

    @Autowired
    EntityTagCommunityRepository entityTagCommunityRepository;

    @Autowired
    TagCommunityRepository tagCommunityRepository;

    @Transactional
    public AddedQuestionPaperResponseDto addQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody, Boolean isPublicPaper) throws JsonProcessingException {

        var questionPaper = createQuestionPaper(user, questionRequestBody, isPublicPaper);

        addEntityTagOfQuestionPaper(questionPaper, questionRequestBody);
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

        addQuestionEntityTags(questions, questionRequestBody.getQuestions());

        List<String> savedQuestionIds = questions.stream().map(Question::getId).toList();

        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), savedQuestionIds);

        if (!isPublicPaper)
            questionPaperRepository.linkInstituteToQuestionPaper(UUID.randomUUID().toString(), questionPaper.getId(), questionRequestBody.getInstituteId(), "ACTIVE", questionRequestBody.getLevelId(), questionRequestBody.getSubjectId());

        return new AddedQuestionPaperResponseDto(questionPaper.getId());

    }

    private void addEntityTagOfQuestionPaper(QuestionPaper questionPaper, AddQuestionPaperDTO questionRequestBody) {
        for (String tag : questionRequestBody.getTags()) {
            String tagId = UUID.randomUUID().toString();
            String existingOrNewTagId = tagCommunityRepository.insertTagIfNotExists(tagId, tag.toLowerCase());
            addEntityTags("QUESTION_PAPER", questionPaper.getId(), existingOrNewTagId, "TAGS");
        }
    }

    private QuestionPaper createQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody, Boolean isPublicPaper) {
        QuestionPaper questionPaper = new QuestionPaper();
        questionPaper.setTitle(questionRequestBody.getTitle());
        questionPaper.setCreatedByUserId(user.getUserId());
        questionPaper.setDifficulty(questionRequestBody.getAiDifficulty());
        questionPaper.setCommunityChapterIds(questionRequestBody.getCommunityChapterIds().isEmpty() ? null : String.join(",", questionRequestBody.getCommunityChapterIds()));

        if (isPublicPaper)
            questionPaper.setAccess(QuestionAccessLevel.PUBLIC.name());
        else
            questionPaper.setAccess(QuestionAccessLevel.PRIVATE.name());

        questionPaper = questionPaperRepository.save(questionPaper);
        return questionPaper;
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
            List<Option> questionOptions = question.getOptions();
            question.setOptions(new ArrayList<>());
            newOptions.addAll(questionOptions);
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


    public Question makeQuestionAndOptionFromImportQuestion(QuestionDTO questionRequest, Boolean isPublic, Question existingQuestion) throws JsonProcessingException {        // Todo: check Question Validation

        Question question = initializeQuestion(questionRequest, existingQuestion);
        List<String> correctOptionIds = new ArrayList<>();

        switch (QuestionTypes.valueOf(questionRequest.getQuestionType())) {
            case NUMERIC:
                handleNumericQuestion(question, questionRequest);
                break;
            case TRUE_FALSE:
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
            List<Option> questionOptions = question.getOptions();
            newOptions.addAll(questionOptions);
        }


        var savedQuestions = questionRepository.saveAll(newQuestions);
        optionRepository.saveAll(newOptions);

        List<String> savedQuestionIds = savedQuestions.stream().map(Question::getId).toList();
        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.get().getId(), savedQuestionIds);
        addQuestionEntityTags(savedQuestions, questionRequestBody.getAddedQuestions());

        newQuestions = new ArrayList<>();
        newOptions = new ArrayList<>();

        for (var importQuestion : questionRequestBody.getUpdatedQuestions()) {
            Optional<Question> existingQuestion = questionRepository.findById(importQuestion.getId());

            if (existingQuestion.isEmpty())
                continue;
            Question question = makeQuestionAndOptionFromImportQuestion(importQuestion, false, existingQuestion.get());
            if (importQuestion.getParentRichText() != null) {
                question.setParentRichText(AssessmentRichTextData.fromDTO(importQuestion.getParentRichText()));
            }
            List<Option> questionOptions = question.getOptions();
            newQuestions.add(question);
            newOptions.addAll(questionOptions);
        }

        var savedUpdatedQuestions = questionRepository.saveAll(newQuestions);
        optionRepository.saveAll(newOptions);
        addQuestionEntityTags(savedUpdatedQuestions, questionRequestBody.getUpdatedQuestions());

        newQuestions = new ArrayList<>();
        newOptions = new ArrayList<>();
        for (var importQuestion : questionRequestBody.getDeletedQuestions()) {
            Optional<Question> existingQuestion = questionRepository.findById(importQuestion.getId());

            if (existingQuestion.isEmpty())
                continue;
            existingQuestion.get().setStatus(DELETED.name());
            newQuestions.add(existingQuestion.get());
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
        if (questionRequest.getAutoEvaluationJson() != null) {
            question.setAutoEvaluationJson((questionRequest.getAutoEvaluationJson()));
        }
        if (questionRequest.getMediaId() != null) {
            question.setMediaId((questionRequest.getMediaId()));
        }
        if (questionRequest.getOptionsJson() != null) {
            question.setOptionsJson((questionRequest.getOptionsJson()));
        }
        if (questionRequest.getAiDifficultyLevel() != null) {
            question.setDifficulty((questionRequest.getAiDifficultyLevel()));
        }
        if (questionRequest.getProblemType() != null) {
            question.setProblemType((questionRequest.getProblemType()));
        }
        question.setQuestionType(questionRequest.getQuestionType());
        switch (questionRequest.getQuestionType()) {
            case "NUMERIC":
                question.setQuestionResponseType(QuestionResponseTypes.INTEGER.name());
                break;
            case "TRUE_FALSE":
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
            if (optionDTO.getId() != null) {
                Optional<Option> existingOption = optionRepository.findById(optionDTO.getId());
                if (existingOption.isPresent()) {
                    option = existingOption.get();
                }
            }
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

    private void addQuestionEntityTags(List<Question> questions, List<QuestionDTO> questionRequests) {

        try {
            for (int i = 0; i < questions.size(); i++) {
                Question question = questions.get(i);
                QuestionDTO questionRequest = questionRequests.get(i);
                for (int j = 0; j < questionRequest.getAiTags().size(); j++) {
                    String tagId = UUID.randomUUID().toString();
                    String existingOrNewTagId = tagCommunityRepository.insertTagIfNotExists(tagId, questionRequest.getAiTags().get(j).toLowerCase());
                    addEntityTags("QUESTION", question.getId(), existingOrNewTagId, "TAGS");
                }

                for (int j = 0; j < questionRequest.getAiTopicsIds().size(); j++) {
                    addEntityTags("QUESTION", question.getId(), questionRequest.getAiTopicsIds().get(j), "TOPIC");
                }
            }
        }
        catch (Exception e) {

        }
    }

    private void addEntityTags(String entityName, String entityId, String tagId, String tagSource) {
        EntityTag entityTag = new EntityTag();
        entityTag.setId(new EntityTagsId(entityId, entityName, tagId));
        entityTag.setTagSource(tagSource);
        try {
            entityTagCommunityRepository.save(entityTag);
        }
        catch (Exception e) {

        }
    }


}
