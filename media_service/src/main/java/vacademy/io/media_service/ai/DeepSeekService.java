package vacademy.io.media_service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Comment;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
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
import vacademy.io.media_service.service.HtmlJsonProcessor;
import vacademy.io.media_service.util.JsonUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DeepSeekService {

    @Autowired
    private ObjectMapper objectMapper;

    private final ChatModel chatModel;

    @Autowired
    private DeepSeekApiService deepSeekApiService;

    @Autowired
    public DeepSeekService(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("<!--DEEPSEEK_PLACEHOLDER_(\\d+)-->");



    public String getQuestionsWithDeepSeekFromTextPrompt(String textPrompt, String numberOfQuestions, String typeOfQuestion, String classLevel, String topics, String language) {

        String template = """
                Text raw prompt :  {textPrompt}
                    
                        Prompt:
                        use the Text raw prompt to generate {numberOfQuestions} {typeOfQuestion} questions for the class level {classLevel} and topics {topics} in {language}, return the output in JSON format as follows:
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
                                         "title": "string" // Suitable title for the question paper ,
                                          "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                    
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("textPrompt", textPrompt, "numberOfQuestions", numberOfQuestions, "typeOfQuestion", typeOfQuestion, "classLevel", classLevel, "topics", topics, "language", language));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek-ai/DeepSeek-V3-0324", prompt.getContents().trim(), 100000);
        if(response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

        return validJson;
    }


    public String getQuestionsWithDeepSeekFromHTML(String htmlData, String userPrompt) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

        if(userPrompt == null) {
            userPrompt = "Include ALL questions in the response. Do not truncate or omit any questions.";
        }

        String template = """
                HTML raw data :  {htmlData}
                    
                        Prompt:
                        Convert the given HTML file containing questions into the following JSON format:
                        - Preserve all DS_TAGs in HTML content in comments
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        Also keep the DS_TAGS field intact in html
                        And do not try to calculate right ans, only add if available in input
                        
                        IMPORTANT: {userPrompt}
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlData", unTaggedHtml, "userPrompt", userPrompt));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek-ai/DeepSeek-V3-0324", prompt.getContents().trim(), 100000);
        if(response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        try {
            String restoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);
            return restoredJson;
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    public String getQuestionsWithDeepSeekFromHTMLOfTopics(String htmlData, String requiredTopics) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

        String template = """
                HTML raw data :  {htmlData}
                
                Required Topics :  {requiredTopics}
                    
                        Prompt:
                        Convert the given HTML file containing questions, only extract questions from the given topics into the following JSON format:
                        - Preserve all DS_TAGs in HTML content in comments
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        
                        Also keep the DS_TAGS field intact in html
                        And do not try to calculate right ans, only add if available in input
                        Give the complete result to all possible questions
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlData", unTaggedHtml, "requiredTopics", requiredTopics));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek-ai/DeepSeek-V3-0324", prompt.getContents().trim(), 100000);
        if(response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        try {
            String restoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);
            return restoredJson;
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }


    public String evaluateManualAnswerSheet(String htmlAnswerData, String htmlQuestionData, Double maxMarks, String evaluationDifficulty) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlAnswerData);

        String template = """
                Question :  {htmlQuestionData}
                
                Answer By Student :  {htmlAnswerData}
                
                Maximum Marks :{maxMarks}
                
                Evaluation Difficulty :{evaluationDifficulty} 
                    
                        Prompt:
                        Evaluate the Answer against the Question and give marks out of maximum marks, evaluate on given evaluation difficulty
                        - Give details of what is wrong referring to the specific part of answer
                        
                        JSON format : 
                        
                                {{
                                         "marks_obtained": double value of marks obtained out of max marks,
                                         "answer_tips": ["<div>part of answer -> this part can be written with better english</div>", "string2", "string3"] // html string list of tips on how to write the answer linking to the students answer use html tags to add styling,
                                         "explanation": "<div>explanation and comparison with correct answer</div>" // html string of correct explanation to the students answer use html tags to add styling,
                                         "topic_wise_understanding": ["<div><b>sub topic</b> -> how is the understanding of the topic for this student</div>", "string2", "string3"] // html string list of topic wise understanding and analysis use html tags to add styling,
                                }}
                            
                      
           
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlQuestionData", htmlQuestionData, "htmlAnswerData", htmlAnswerData, "maxMarks", maxMarks, "evaluationDifficulty", evaluationDifficulty));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek-ai/DeepSeek-V3-0324", prompt.getContents().trim(), 100000);
        if(response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        try {
            String restoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);
            return restoredJson;
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }



    public String getQuestionsWithDeepSeekFromAudio(String audioString, String difficulty, String numQuestions, String optionalPrompt, String language) {
        String template = """
                Class Lecture raw data :  {classLecture}
                Questions Difficulty :  {difficulty}
                Number of Questions :  {numQuestions}
                Optional Teacher Prompt :  {optionalPrompt}
                Language of questions:  {language}
                
                        Prompt:
                        From the given audio lecture compile hard and medium questions, try engaging questions, convert it into the following JSON format:
                        
                        JSON format : 
                        
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
                                         "title": "string" // Suitable title for the question paper,
                                         "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] // multiple chapter and topic names for question paper,
                                         "difficulty": "easy | medium | hard",
                                         "subjects": ["subject1", "subject2", "subject3", "subject4", "subject5"] // multiple subject names for question paper like maths or thermodynamics or physics etc ,
                                         "classes": ["class 1" , "class 2" ] // can be of multiple class - | class 3 | class 4 | class 5 | class 6 | class 7 | class 8 | class 9 | class 10 | class 11 | class 12 | engineering | medical | commerce | law
                                     }}
                            
                        For LONG_ANSWER, NUMERIC, and ONE_WORD question types:
                        - Leave 'correct_options' empty but fill 'ans' and 'exp'
                        - Omit 'options' field entirely
                        """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("classLecture", audioString, "difficulty", difficulty, "numQuestions", numQuestions, "optionalPrompt", optionalPrompt));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek-ai/DeepSeek-V3-0324", prompt.getContents().trim(), 100000);
        if(response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        return validJson;
    }

    public List<QuestionDTO> formatQuestions(AiGeneratedQuestionJsonDto[] questions) {
        if (questions == null || questions.length == 0) {
            throw new IllegalArgumentException("Question array cannot be null or empty");
        }

        List<QuestionDTO> formattedQuestions = new ArrayList<>();

        for (AiGeneratedQuestionJsonDto question : questions) {
            if (question == null) continue; // Avoid NullPointerException if any element is null
            String questionContent = question.getQuestion().getContent();
            questionContent = unescapeString(questionContent);
            question.getQuestion().setContent(questionContent);
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

    public QuestionDTO handleMCQS(AiGeneratedQuestionJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.OPTION.name());
        question.setQuestionType(AiGeneratedQuestionJsonDto.QuestionType.MCQS.name());
        question.setTags(questionRequest.getTags());
        question.setLevel(questionRequest.getLevel());
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
                (questionRequest.getCorrectOptions() == null || questionRequest.getCorrectOptions().isEmpty())? new ArrayList<>() : questionRequest.getCorrectOptions().stream()
                        .map(String::valueOf)
                        .collect(Collectors.toList())
        );



        // Process Options
        for (AiGeneratedQuestionJsonDto.Option optionDTO : questionRequest.getOptions()) {
            question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", unescapeString(optionDTO.getContent()))));
        }

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings" + e.getMessage());
        }

        return question;
    }

    public QuestionDTO handleMCQM(AiGeneratedQuestionJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.OPTION.name());
        question.setQuestionType(AiGeneratedQuestionJsonDto.QuestionType.MCQM.name());

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


        // Process Options
        for (AiGeneratedQuestionJsonDto.Option optionDTO : questionRequest.getOptions()) {
            question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", unescapeString(optionDTO.getContent()))));
        }

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings "+ e.getMessage());
        }

        return question;
    }

    public QuestionDTO handleOneWord(AiGeneratedQuestionJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.ONE_WORD.name());
        question.setQuestionType(AiGeneratedQuestionJsonDto.QuestionType.ONE_WORD.name());

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

    public QuestionDTO handleLongAnswer(AiGeneratedQuestionJsonDto questionRequest) {
        QuestionDTO question = new QuestionDTO();
        question.setAccessLevel("PUBLIC");
        question.setQuestionResponseType(QuestionResponseType.LONG_ANSWER.name());
        question.setQuestionType(AiGeneratedQuestionJsonDto.QuestionType.LONG_ANSWER.name());
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

    /**
     * Cleans a string by:
     * 1. Removing backslashes that escape quotes
     * 2. Converting Unicode escape sequences like \u003c to corresponding characters
     * 3. Handling common escape sequences like \n, \t, etc.
     *
     * @param input The string with escape sequences
     * @return The cleaned string with actual characters
     */
    public static String unescapeString(String input) {
        if (input == null) {
            return null;
        }

        StringBuilder result = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);

            // Handle backslash escape sequences
            if (c == '\\' && i + 1 < input.length()) {
                char next = input.charAt(i + 1);

                switch (next) {
                    case '"':
                        result.append('"');
                        i++;
                        break;
                    case '\\':
                        result.append('\\');
                        i++;
                        break;
                    case 'n':
                        result.append('\n');
                        i++;
                        break;
                    case 't':
                        result.append('\t');
                        i++;
                        break;
                    case 'r':
                        result.append('\r');
                        i++;
                        break;
                    case 'u':

                        if (i + 5 < input.length()) {
                            try {
                                String hex = input.substring(i + 2, i + 6);
                                int codePoint = Integer.parseInt(hex, 16);
                                result.append((char) codePoint);
                                i += 5; // Skip the 'u' and 4 hex digits
                            } catch (NumberFormatException e) {
                                // If invalid hex, keep the original sequence
                                result.append(c);
                            }
                        } else {
                            // Not enough characters for a complete Unicode escape
                            result.append(c);
                        }
                        break;
                    default:
                        // For any unrecognized escape, just keep the backslash and the character
                        result.append(c);
                        break;
                }
            } else {
                // Regular character, just append it
                result.append(c);
            }
        }

        return result.toString();
    }
}