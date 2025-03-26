package vacademy.io.media_service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.enums.QuestionResponseType;
import vacademy.io.media_service.enums.QuestionTypes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class DeepSeekService {

    @Autowired
    private ObjectMapper objectMapper;

    private final ChatModel chatModel;

    @Autowired
    public DeepSeekService(ChatModel chatModel) {
        this.chatModel = chatModel;
    }


    public String getQuestionsWithDeepSeekFromTextPrompt(String textPrompt, String numberOfQuestions, String typeOfQuestion, String classLevel, String topics) {

        String template = """
                Text raw prompt :  {textPrompt}
                    
                        Prompt:
                        use the Text raw prompt to generate {numberOfQuestions} {typeOfQuestion} questions for the class level {classLevel} and topics {topics}, return the output in JSON format as follows:
                                {{
                                         "questions": [
                                             {{
                                                 "question_number": "number",
                                                 "question": {{
                                                     "type": "HTML",
                                                     "content": "string" // Include img tags if present
                                                 }},
                                                 "options": [
                                                     {{
                                                         "type": "HTML",
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": "number[]",
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER | NUMERIC",
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                                 "level": "easy | medium | hard"
                                             }}
                                         ],
                                         "title": "string" // Suitable title for the question paper
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("textPrompt", textPrompt, "numberOfQuestions", numberOfQuestions, "typeOfQuestion", typeOfQuestion, "classLevel", classLevel, "topics", topics));

        ChatResponse response = chatModel.call(
                prompt);

        return response.getResult().getOutput().toString();
    }


    public String getQuestionsWithDeepSeekFromHTML(String htmlData) {

        String template = """
                HTML raw data :  {htmlData}
                    
                        Prompt:
                        Convert the given HTML file containing questions into the following JSON format:
                                {{
                                         "questions": [
                                             {{
                                                 "question_number": "number",
                                                 "question": {{
                                                     "type": "HTML",
                                                     "content": "string" // Include img tags if present
                                                 }},
                                                 "options": [
                                                     {{
                                                         "type": "HTML",
                                                         "content": "string" // Include img tags if present
                                                     }}
                                                 ],
                                                 "correct_options": "number[]",
                                                 "ans": "string",
                                                 "exp": "string",
                                                 "question_type": "MCQS | MCQM | ONE_WORD | LONG_ANSWER | NUMERIC",
                                                 "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                                                 "level": "easy | medium | hard"
                                             }}
                                         ],
                                         "title": "string" // Suitable title for the question paper
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlData", htmlData));

        ChatResponse response = chatModel.call(
                prompt);

        return response.getResult().getOutput().toString();
    }

    public List<QuestionDTO> formatQuestions(AiGeneratedQuestisonJsonDto[] questions) {
        if (questions == null || questions.length == 0) {
            throw new IllegalArgumentException("Question array cannot be null or empty");
        }

        List<QuestionDTO> formattedQuestions = new ArrayList<>();

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

    public QuestionDTO handleMCQS(AiGeneratedQuestisonJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.OPTION.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.MCQS.name());

        // Set Explanation
        AssessmentRichTextDataDTO assessmentRichTextDataExp = new AssessmentRichTextDataDTO();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationText(assessmentRichTextDataExp);

        // Set Question Text
        AssessmentRichTextDataDTO assessmentRichTextDataQuestion = new AssessmentRichTextDataDTO();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setText(assessmentRichTextDataQuestion);

        // Initialize Evaluation
        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQS.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();
        mcqData.setCorrectOptionIds(
                questionRequest.getCorrectOptions().stream()
                        .map(String::valueOf)
                        .collect(Collectors.toList())
        );



        // Process Options
        for (AiGeneratedQuestisonJsonDto.Option optionDTO : questionRequest.getOptions()) {
            question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", optionDTO.getContent())));
        }

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings" + e.getMessage());
        }

        return question;
    }

    public QuestionDTO handleMCQM(AiGeneratedQuestisonJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.OPTION.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.MCQM.name());

        // Set Explanation
        AssessmentRichTextDataDTO assessmentRichTextDataExp = new AssessmentRichTextDataDTO();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationText(assessmentRichTextDataExp);

        // Set Question Text
        AssessmentRichTextDataDTO assessmentRichTextDataQuestion = new AssessmentRichTextDataDTO();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setText(assessmentRichTextDataQuestion);

        // Initialize Evaluation
        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQM.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();
        mcqData.setCorrectOptionIds(
                questionRequest.getCorrectOptions().stream()
                        .map(String::valueOf)
                        .collect(Collectors.toList())
        );


        List<String> correctOptionIds = new ArrayList<>();
        List<OptionDTO> options = new ArrayList<>();

        // Process Options
        for (AiGeneratedQuestisonJsonDto.Option optionDTO : questionRequest.getOptions()) {
            question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", optionDTO.getContent())));
        }

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new RuntimeException("Failed to process question settings", e);
        }

        return question;
    }

    public QuestionDTO handleOneWord(AiGeneratedQuestisonJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.ONE_WORD.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.ONE_WORD.name());

        AssessmentRichTextDataDTO assessmentRichTextDataExp = new AssessmentRichTextDataDTO();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationText(assessmentRichTextDataExp);

        AssessmentRichTextDataDTO assessmentRichTextDataQuestion = new AssessmentRichTextDataDTO();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setText(assessmentRichTextDataQuestion);

        OneWordEvaluationDTO requestEvaluation = new OneWordEvaluationDTO();
        OneWordEvaluationDTO.OneWordEvaluationData data = new OneWordEvaluationDTO.OneWordEvaluationData();
        requestEvaluation.setType(QuestionTypes.ONE_WORD.name());
        data.setAnswer(questionRequest.getAns());
        requestEvaluation.setData(data);

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new RuntimeException("Failed to process question settings", e);
        }

        return question;
    }

    public QuestionDTO handleLongAnswer(AiGeneratedQuestisonJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.LONG_ANSWER.name());
        question.setQuestionType(AiGeneratedQuestisonJsonDto.QuestionType.LONG_ANSWER.name());
        AssessmentRichTextDataDTO assessmentRichTextDataExp = new AssessmentRichTextDataDTO();
        assessmentRichTextDataExp.setContent(questionRequest.getExp());
        assessmentRichTextDataExp.setType("HTML");
        question.setExplanationText(assessmentRichTextDataExp);
        AssessmentRichTextDataDTO assessmentRichTextDataQuestion = new AssessmentRichTextDataDTO();
        assessmentRichTextDataQuestion.setContent(questionRequest.getQuestion().getContent());
        assessmentRichTextDataQuestion.setType("HTML");
        question.setText(assessmentRichTextDataQuestion);

        LongAnswerEvaluationDTO requestEvaluation = new LongAnswerEvaluationDTO();
        LongAnswerEvaluationDTO.LongAnswerEvaluationData data = new LongAnswerEvaluationDTO.LongAnswerEvaluationData();
        requestEvaluation.setType(QuestionTypes.LONG_ANSWER.name());
        AssessmentRichTextDataDTO assessmentRichTextDataAns = new AssessmentRichTextDataDTO();
        assessmentRichTextDataAns.setType("HTML");
        assessmentRichTextDataAns.setContent(questionRequest.getAns());
        data.setAnswer(assessmentRichTextDataAns);
        requestEvaluation.setData(data);

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new RuntimeException("Failed to process question settings", e);
        }

        return question;

    }

    public String setEvaluationJson(MCQEvaluationDTO mcqEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(mcqEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    // function for numeric json
    public String setEvaluationJson(NumericalEvaluationDto numericalEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(numericalEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setEvaluationJson(OneWordEvaluationDTO oneWordEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(oneWordEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setEvaluationJson(LongAnswerEvaluationDTO longAnswerEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(longAnswerEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }


}