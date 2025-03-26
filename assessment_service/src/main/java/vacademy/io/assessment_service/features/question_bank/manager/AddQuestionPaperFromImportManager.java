package vacademy.io.assessment_service.features.question_bank.manager;


import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_bank.dto.*;
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
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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
            Question question = makeQuestionAndOptionFromImportQuestion(questionRequestBody.getQuestions().get(i), isPublicPaper);

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
    public AddedQuestionPaperResponseDto addAiGeneratedQuestionPaper(CustomUserDetails user, AiGeneratedQuestionPaperJsonDto questionRequestBody) throws JsonProcessingException {
        QuestionPaper questionPaper = new QuestionPaper();
        questionPaper.setTitle(questionRequestBody.getTitle());
        questionPaper.setCreatedByUserId(user.getUserId());

        questionPaper = questionPaperRepository.save(questionPaper);

        questionPaper.setAccess(QuestionAccessLevel.PUBLIC.name());

        questionPaper = questionPaperRepository.save(questionPaper);

        List<Question> questions = formatQuestions(questionRequestBody.getQuestions());
//        questions = questionRepository.saveAll(questions);

        List<String> savedQuestionIds = questions.stream().map(Question::getId).toList();

        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), savedQuestionIds);


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
            Question question = makeQuestionAndOptionFromImportQuestion(importQuestion, isPublicPaper);
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

    public List<Question> formatQuestions(AiGeneratedQuestisonJsonDto[] questions) {
        if (questions == null || questions.length == 0) {
            throw new IllegalArgumentException("Question array cannot be null or empty");
        }

        List<Question> formattedQuestions = new ArrayList<>();

        for (AiGeneratedQuestisonJsonDto question : questions) {
            if (question == null) continue; // Avoid NullPointerException if any element is null

            switch (question.getQuestionType()) {  // Accessing enum correctly
                case MCQS:
                    formattedQuestions.add(handleMCQS(question));
                    break;
                case MCQM:
                    formattedQuestions.add(handleMCQM(question));
                    break;
                case ONE_WORD:
                    formattedQuestions.add(handleOneWord(question));

                    break;
                case LONG_ANSWER:
                    formattedQuestions.add(handleLongAnswer(question));
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported question type: " + question.getQuestionType());
            }
        }

        return formattedQuestions;
    }

    public Question handleMCQS(AiGeneratedQuestisonJsonDto questionRequest) {
        Question question = new Question();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.MCQS.name());

        // Set Explanation
        AssessmentRichTextData assessmentRichTextDataExp = new AssessmentRichTextData();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationTextData(assessmentRichTextDataExp);

        // Set Question Text
        AssessmentRichTextData assessmentRichTextDataQuestion = new AssessmentRichTextData();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setTextData(assessmentRichTextDataQuestion);

        // Initialize Evaluation
        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQS.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

        List<String> correctOptionIds = new ArrayList<>();
        List<Option> options = new ArrayList<>();

        // Process Options
        for (AiGeneratedQuestisonJsonDto.Option optionDTO : questionRequest.getOptions()) {
            Option option = new Option();
            UUID optionId = UUID.randomUUID();
            option.setId(optionId.toString());
            AssessmentRichTextData assessmentRichTextData = new AssessmentRichTextData();
            assessmentRichTextData.setContent(optionDTO.getContent());
            assessmentRichTextData.setType("HTML");
            option.setText(assessmentRichTextData);
            option.setQuestion(question);
            options.add(option);
        }

        // Save Question & Options
        question = questionRepository.save(question);
        options = optionRepository.saveAll(options); // Ensure options are saved

        // Assign Correct Option IDs After Saving
        List<Option> savedOptions = optionRepository.saveAll(options); // Save options first

// Assign correct option IDs after saving
        for (int i = 0; i < savedOptions.size(); i++) {
            if (questionRequest.getCorrectOptions().contains(i)) {
                correctOptionIds.add(savedOptions.get(i).getId());
            }
        }

        mcqData.setCorrectOptionIds(correctOptionIds);
        requestEvaluation.setData(mcqData);

        try {
            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings"+ e.getMessage());
        }

        return question;
    }

    public Question handleMCQM(AiGeneratedQuestisonJsonDto questionRequest) {
        Question question = new Question();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.MCQM.name());

        // Set Explanation
        AssessmentRichTextData assessmentRichTextDataExp = new AssessmentRichTextData();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationTextData(assessmentRichTextDataExp);

        // Set Question Text
        AssessmentRichTextData assessmentRichTextDataQuestion = new AssessmentRichTextData();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setTextData(assessmentRichTextDataQuestion);

        // Initialize Evaluation
        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQM.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

        List<String> correctOptionIds = new ArrayList<>();
        List<Option> options = new ArrayList<>();

        // Process Options
        for (AiGeneratedQuestisonJsonDto.Option optionDTO : questionRequest.getOptions()) {
            Option option = new Option();
            UUID optionId = UUID.randomUUID();
            option.setId(optionId.toString());
            AssessmentRichTextData assessmentRichTextData = new AssessmentRichTextData();
            assessmentRichTextData.setContent(optionDTO.getContent());
            assessmentRichTextData.setType("HTML");
            option.setText(assessmentRichTextData);
            option.setQuestion(question);
            options.add(option);
        }

        // Save Question & Options
        question = questionRepository.save(question);
        options = optionRepository.saveAll(options); // Ensure options are saved

        // Assign Correct Option IDs After Saving
        List<Option> savedOptions = optionRepository.saveAll(options); // Save options first

// Assign correct option IDs after saving
        for (int i = 0; i < savedOptions.size(); i++) {
            if (questionRequest.getCorrectOptions().contains(i)) {
                correctOptionIds.add(savedOptions.get(i).getId());
            }
        }

        mcqData.setCorrectOptionIds(correctOptionIds);
        requestEvaluation.setData(mcqData);

        try {
            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings " + e.getMessage());
        }

        return question;
    }

    public Question handleOneWord(AiGeneratedQuestisonJsonDto questionRequest) {
        Question question = new Question();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseTypes.ONE_WORD.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.ONE_WORD.name());
        AssessmentRichTextData assessmentRichTextDataExp = new AssessmentRichTextData();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationTextData(assessmentRichTextDataExp);
        AssessmentRichTextData assessmentRichTextDataQuestion = new AssessmentRichTextData();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setTextData(assessmentRichTextDataQuestion);

        OneWordEvaluationDTO requestEvaluation = new OneWordEvaluationDTO();
        OneWordEvaluationDTO.OneWordEvaluationData data = new OneWordEvaluationDTO.OneWordEvaluationData();
        requestEvaluation.setType(QuestionTypes.ONE_WORD.name());
        data.setAnswer(questionRequest.getAns());
        requestEvaluation.setData(data);

        try {
            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings "+ e.getMessage());
        }

        return question;
    }

    public Question handleLongAnswer(AiGeneratedQuestisonJsonDto questionRequest) {
        Question question = new Question();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseTypes.LONG_ANSWER.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.LONG_ANSWER.name());
        AssessmentRichTextData assessmentRichTextDataExp = new AssessmentRichTextData();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationTextData(assessmentRichTextDataExp);
        AssessmentRichTextData assessmentRichTextDataQuestion = new AssessmentRichTextData();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setTextData(assessmentRichTextDataQuestion);

        LongAnswerEvaluationDTO requestEvaluation = new LongAnswerEvaluationDTO();
        LongAnswerEvaluationDTO.LongAnswerEvaluationData data = new LongAnswerEvaluationDTO.LongAnswerEvaluationData();
        requestEvaluation.setType(QuestionTypes.LONG_ANSWER.name());
        AssessmentRichTextDataDTO assessmentRichTextDataAns = new AssessmentRichTextDataDTO();
        assessmentRichTextDataAns.setType("HTML");
        assessmentRichTextDataAns.setContent(questionRequest.getAns());
        data.setAnswer(assessmentRichTextDataAns);
        requestEvaluation.setData(data);
        question = questionRepository.save(question);

        try {
            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings "+ e.getMessage());
        }

        return question;

    }
//        TODO: handle numeric type question
//    public Question handleNumeric(AiGeneratedQuestisonJsonDto questionRequest) {
//        Question question = new Question();
//        question.setAccessLevel("PUBLIC");
//        question.setQuestionResponseType(QuestionResponseTypes.INTEGER.name());
//        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.NUMERIC.name());
//        AssessmentRichTextData assessmentRichTextDataExp = new AssessmentRichTextData();
//        assessmentRichTextDataExp.setContent(questionRequest.getExp());
//        assessmentRichTextDataExp.setType("HTML");
//        question.setExplanationTextData(assessmentRichTextDataExp);
//        AssessmentRichTextData assessmentRichTextDataQuestion = new AssessmentRichTextData();
//        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
//        assessmentRichTextDataQuestion.setType("HTML");
//        question.setTextData(assessmentRichTextDataQuestion);
//
//        NumericalEvaluationDto requestEvaluation = new NumericalEvaluationDto();
//        NumericalEvaluationDto.NumericalData data = new NumericalEvaluationDto.NumericalData();
//        requestEvaluation.setType(QuestionTypes.NUMERIC.name());
//        AssessmentRichTextDataDTO assessmentRichTextDataAns = new AssessmentRichTextDataDTO();
//        assessmentRichTextDataAns.setType("HTML");
//        assessmentRichTextDataAns.setContent(questionRequest.getAns());
//        data.setValidAnswers(questionRequest.getAns().t);
//        requestEvaluation.setData(data);
//        question = questionRepository.save(question);
//
//        try {
//            question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(requestEvaluation));
//        } catch (Exception e) {
//            throw new RuntimeException("Failed to process question settings", e);
//        }
//
//        return question;
//    }

    public Question makeQuestionAndOptionFromImportQuestion(QuestionDTO questionRequest, Boolean isPublic) throws JsonProcessingException {
        // Todo: check Question Validation

        Question question = initializeQuestion(questionRequest);

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

    public Boolean editQuestionPaper(CustomUserDetails user, AddQuestionPaperDTO questionRequestBody) {
        Optional<QuestionPaper> questionPaper = questionPaperRepository.findById(questionRequestBody.getId());

        if (questionPaper.isEmpty())
            return false;

        return true;
        // todo : edit question paper

    }

    public AddQuestionDTO addPrivateQuestions(CustomUserDetails user, AddQuestionDTO questionRequestBody, boolean isPublicQuestion) throws JsonProcessingException {

        List<Option> options = new ArrayList<>();
        for (int i = 0; i < questionRequestBody.getQuestions().size(); i++) {
            Question question = makeQuestionAndOptionFromImportQuestion(questionRequestBody.getQuestions().get(i), isPublicQuestion);
            options.addAll(question.getOptions());
            question = questionRepository.save(question);
            questionRequestBody.getQuestions().get(i).setId(question.getId());
            options = optionRepository.saveAll(options);
            options.clear();
        }

        return questionRequestBody;
    }

    private Question initializeQuestion(QuestionDTO questionRequest) {
        Question question = new Question();
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
