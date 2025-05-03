package vacademy.io.media_service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.constant.ConstantAiTemplate;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorRequest;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorResponse;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.*;
import vacademy.io.media_service.service.HtmlJsonProcessor;
import vacademy.io.media_service.service.TaskStatusService;
import vacademy.io.media_service.util.JsonUtils;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DeepSeekService {

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("<!--DEEPSEEK_PLACEHOLDER_(\\d+)-->");
    private final ChatModel chatModel;
    @Autowired
    TaskStatusService taskStatusService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private DeepSeekApiService deepSeekApiService;

    @Autowired
    public DeepSeekService(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    public static Boolean getIsProcessCompleted(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(json);

            JsonNode isCompletedNode = rootNode.get("is_process_completed");
            if (isCompletedNode != null && isCompletedNode.isBoolean()) {
                return isCompletedNode.asBoolean();
            }
            return false; // or false as a fallback
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
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

    public static int getQuestionCount(String jsonString) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonString);
            JsonNode questions = root.get("questions");
            return questions != null && questions.isArray() ? questions.size() : 0;
        } catch (Exception e) {
            e.printStackTrace();
            return 0;
        }
    }

    public static String getCommaSeparatedQuestionNumbers(String json) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(json);
            JsonNode questionsNode = rootNode.get("questions");

            if (questionsNode == null || !questionsNode.isArray()) {
                return "";
            }

            List<String> questionNumbers = new ArrayList<>();
            for (JsonNode question : questionsNode) {
                String number = question.get("question_number").asText();
                questionNumbers.add(number);
            }

            return String.join(",", questionNumbers);
        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
    }

    public static String mergeQuestionsJson(String oldJson, String newJson) {
        try {
            ObjectMapper mapper = new ObjectMapper();

            JsonNode oldNode = (oldJson == null || oldJson.isBlank())
                    ? mapper.readTree("{\"questions\":[]}")
                    : mapper.readTree(oldJson);
            JsonNode newNode = mapper.readTree(newJson);

            ObjectNode mergedNode = (ObjectNode) oldNode;

            // Merge questions
            ArrayNode mergedQuestions = mapper.createArrayNode();
            if (oldNode.has("questions")) {
                mergedQuestions.addAll((ArrayNode) oldNode.get("questions"));
            }
            if (newNode.has("questions")) {
                ArrayNode newQuestions = (ArrayNode) newNode.get("questions");
                for (JsonNode q : newQuestions) {
                    if (q.has("question_type") && !q.get("question_type").asText().isBlank()
                            && ValidQuestionTypeEnums.isValid(q.get("question_type").asText())) {
                        mergedQuestions.add(q);
                    }
                }
            }
            mergedNode.set("questions", mergedQuestions);

            // Merge is_process_completed
            boolean oldCompleted = oldNode.has("is_process_completed") && oldNode.get("is_process_completed").asBoolean();
            boolean newCompleted = newNode.has("is_process_completed") && newNode.get("is_process_completed").asBoolean();
            mergedNode.put("is_process_completed", newCompleted);

            // Merge title (keep old if exists)
            if (!oldNode.has("title") && newNode.has("title")) {
                mergedNode.put("title", newNode.get("title").asText());
            }

            // Merge difficulty (keep old if exists)
            if (!oldNode.has("difficulty") && newNode.has("difficulty")) {
                mergedNode.put("difficulty", newNode.get("difficulty").asText());
            }

            // Merge tags, subjects, classes
            mergeStringArrayField(mergedNode, oldNode, newNode, "tags", mapper);
            mergeStringArrayField(mergedNode, oldNode, newNode, "subjects", mapper);
            mergeStringArrayField(mergedNode, oldNode, newNode, "classes", mapper);

            // Merge topicQuestionMap if present
            if (newNode.has("topicQuestionMap")) {
                Map<String, Set<Integer>> topicMap = new LinkedHashMap<>();

                // Load old map
                if (oldNode.has("topicQuestionMap")) {
                    for (JsonNode node : oldNode.get("topicQuestionMap")) {
                        String topic = node.get("topic").asText();
                        Set<Integer> questions = new HashSet<>();
                        for (JsonNode q : node.get("questionNumbers")) {
                            questions.add(q.asInt());
                        }
                        topicMap.put(topic, questions);
                    }
                }

                // Load and merge new map
                for (JsonNode node : newNode.get("topicQuestionMap")) {
                    String topic = node.get("topic").asText();
                    Set<Integer> questions = topicMap.getOrDefault(topic, new HashSet<>());
                    for (JsonNode q : node.get("questionNumbers")) {
                        questions.add(q.asInt());
                    }
                    topicMap.put(topic, questions);
                }

                // Convert to ArrayNode
                ArrayNode topicMapNode = mapper.createArrayNode();
                for (Map.Entry<String, Set<Integer>> entry : topicMap.entrySet()) {
                    ObjectNode topicNode = mapper.createObjectNode();
                    topicNode.put("topic", entry.getKey());
                    ArrayNode qArray = mapper.createArrayNode();
                    entry.getValue().stream().sorted().forEach(qArray::add);
                    topicNode.set("questionNumbers", qArray);
                    topicMapNode.add(topicNode);
                }

                mergedNode.set("topicQuestionMap", topicMapNode);
            }

            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(mergedNode);
        } catch (Exception e) {
            return oldJson != null ? oldJson : newJson;
        }
    }

    private static void mergeStringArrayField(ObjectNode mergedNode, JsonNode oldNode, JsonNode newNode, String fieldName, ObjectMapper mapper) {
        Set<String> uniqueValues = new LinkedHashSet<>();
        if (oldNode.has(fieldName)) {
            oldNode.get(fieldName).forEach(n -> uniqueValues.add(n.asText()));
        }
        if (newNode.has(fieldName)) {
            newNode.get(fieldName).forEach(n -> uniqueValues.add(n.asText()));
        }
        ArrayNode mergedArray = mapper.createArrayNode();
        uniqueValues.forEach(mergedArray::add);
        mergedNode.set(fieldName, mergedArray);
    }

    public String getQuestionsWithDeepSeekFromTextPrompt(String textPrompt, String numberOfQuestions, String typeOfQuestion, String classLevel, String topics, String language, TaskStatus taskStatus, Integer attempt, String oldJson) {
        try {
            if (attempt >= 4) return oldJson;
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(oldJson);
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(textPrompt);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.TEXT_TO_QUESTIONS);

            Map<String, Object> promptMap = Map.of("textPrompt", textPrompt, "numberOfQuestions", numberOfQuestions, "typeOfQuestion", typeOfQuestion, "classLevel", classLevel, "topics", topics, "language", language,
                    "allQuestionNumbers", allQuestionNumbers);
            Prompt prompt = new PromptTemplate(template).create(promptMap);
            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson);
                return oldJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);


            String mergedJson = mergeQuestionsJson(oldJson, restored);

            if (getIsProcessCompleted(mergedJson)) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson);
                return mergedJson;
            }
            if (getQuestionCount(mergedJson) >= Integer.parseInt(numberOfQuestions)) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson);
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), mergedJson);

            return getQuestionsWithDeepSeekFromTextPrompt(textPrompt, numberOfQuestions, typeOfQuestion, classLevel, topics, language, taskStatus, attempt + 1, mergedJson);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson);
            return oldJson;
        }
    }

    public QuestionMetadataExtractorResponse getQuestionsMetadata(QuestionMetadataExtractorRequest request) {


        try {

            var previewIdAndQuestionTextCompressed = getPreviewIdAndQuestionTextCompressed(request);

            String questionIdAndTextPrompt = previewIdAndQuestionTextCompressed.entrySet().stream().map(e ->  "question_id:" + e.getKey() + " text : " + e.getValue()).collect(Collectors.joining("\n"));
            String topicIdAndNamePrompt = request.getIdAndTopics().entrySet().stream().map( e -> "topic_id:" + e.getKey() + " name : " + e.getValue()).collect(Collectors.joining("\n"));

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.EXTRACT_QUESTION_METADATA);

            Map<String, Object> promptMap = Map.of("idAndQuestions", questionIdAndTextPrompt, "idAndTopics", topicIdAndNamePrompt);

            Prompt prompt = new PromptTemplate(template).create(promptMap);


            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);

            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                throw new Exception("Failed to get response from deepseek");
            }

            String validJson = JsonUtils.extractAndSanitizeJson(response.getChoices().get(0).getMessage().getContent());
            QuestionMetadataExtractorResponse objectResponse = objectMapper.readValue(validJson, new TypeReference<QuestionMetadataExtractorResponse>() {
            });
            return objectResponse;
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    private Map<String, String> getPreviewIdAndQuestionTextCompressed(QuestionMetadataExtractorRequest request) {
        Map<String, String> previewIdAndQuestionTextCompressed = new HashMap<>();
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        for (Map.Entry<String, String> entry : request.getPreviewIdAndQuestionText().entrySet()) {
            String previewId = entry.getKey();
            String questionText = entry.getValue();
            String unTaggedHtmlQuestion = htmlJsonProcessor.removeTags(questionText);
            previewIdAndQuestionTextCompressed.put(previewId, unTaggedHtmlQuestion);
        }
        return previewIdAndQuestionTextCompressed;
    }

    public String getQuestionsWithDeepSeekFromHTML(String htmlData, String userPrompt) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

        if (userPrompt == null) {
            userPrompt = "Include first 20 questions in the response. Do not truncate or omit any questions.";
        }

        String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.HTML_TO_QUESTIONS);

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlData", unTaggedHtml, "userPrompt", userPrompt));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
        if (response.getChoices().isEmpty()) {
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

    public String getQuestionsWithDeepSeekFromHTMLRecursive(String htmlData, String userPrompt, String restoredJson, int attempt, TaskStatus taskStatus) {
        try {
            if (attempt >= 5) {
                return restoredJson != null ? restoredJson : "";
            }
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(restoredJson);
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);


            if (userPrompt == null) {
                userPrompt = "Include first 20 questions in the response. Do not truncate or omit any questions.";
            }

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PDF_TO_QUESTIONS);

            Map<String, Object> promptMap = Map.of(
                    "htmlData", unTaggedHtml,
                    "userPrompt", userPrompt,
                    "allQuestionNumbers", allQuestionNumbers
            );

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson);
                return restoredJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);


            String mergedJson = mergeQuestionsJson(restoredJson, restored);

            if (getIsProcessCompleted(mergedJson)) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson);
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", restoredJson);
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLRecursive(htmlData, userPrompt, mergedJson, attempt + 1, taskStatus);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson);
            return restoredJson;
        }
    }

    public String getQuestionsWithDeepSeekFromHTMLOfTopics(String htmlData, String requiredTopics, String restoredJson, Integer attempt, TaskStatus taskStatus) {
        try {
            if (attempt >= 5) {
                return restoredJson != null ? restoredJson : "";
            }
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(restoredJson);
            String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PDF_TO_QUESTIONS_WITH_TOPIC);

            Map<String, Object> promptMap = Map.of("htmlData", unTaggedHtml, "requiredTopics", requiredTopics,
                    "allQuestionNumbers", allQuestionNumbers,
                    "restoredJson", restoredJson == null ? "" : restoredJson);

            Prompt prompt = new PromptTemplate(template).create();

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson);
                return restoredJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            String newRestoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);

            String mergedJson = mergeQuestionsJson(restoredJson, newRestoredJson);

            if (getIsProcessCompleted(mergedJson)) {
                taskStatusService.updateTaskStatus(taskStatus, null, mergedJson);
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", restoredJson);
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLOfTopics(htmlData, requiredTopics, mergedJson, attempt + 1, taskStatus);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson);
            throw new RuntimeException(e);
        }
    }

    public String evaluateManualAnswerSheet(String htmlAnswerData, String htmlQuestionData, Double maxMarks, String evaluationDifficulty) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlAnswerData);

        String template = """
                                
                           
                """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlQuestionData", htmlQuestionData, "htmlAnswerData", htmlAnswerData, "maxMarks", maxMarks, "evaluationDifficulty", evaluationDifficulty));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
        if (response.getChoices().isEmpty()) {
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

    public String getQuestionsWithDeepSeekFromAudio(String audioString, String difficulty, String numQuestions, String optionalPrompt, String oldResponse, int attempt, TaskStatus taskStatus) {
        try {
            if (attempt >= 5) {
                return oldResponse;
            }
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(oldResponse);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS);

            Map<String, Object> promptMap = Map.of("classLecture", audioString, "difficulty", difficulty, "numQuestions", numQuestions, "optionalPrompt", optionalPrompt, "language", "en",
                    "allQuestionNumbers", allQuestionNumbers);
            Prompt prompt = new PromptTemplate(template).create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);

            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldResponse);
                return oldResponse;
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String mergedJson = mergeQuestionsJson(oldResponse, validJson);

            int currentQuestionCount = getQuestionCount(mergedJson);
            log.info("MergedJson: " + mergedJson);
            log.info("Total Questions: " + currentQuestionCount);

            if (getIsProcessCompleted(mergedJson)) {
                taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", mergedJson);
                return mergedJson;
            }


            if (!Objects.isNull(numQuestions) && numQuestions.isEmpty() && currentQuestionCount >= Integer.parseInt(numQuestions)) {
                taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", mergedJson);
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", mergedJson);
            return getQuestionsWithDeepSeekFromAudio(audioString, difficulty, numQuestions, optionalPrompt, mergedJson, attempt + 1, taskStatus);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldResponse);
            return oldResponse;
        }
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
                (questionRequest.getCorrectOptions() == null || questionRequest.getCorrectOptions().isEmpty()) ? new ArrayList<>() : questionRequest.getCorrectOptions().stream()
                        .map(String::valueOf)
                        .collect(Collectors.toList())
        );
        requestEvaluation.setData(mcqData);


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
            throw new VacademyException("Failed to process question settings " + e.getMessage());
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

    public String getQuestionsWithDeepSeekFromHTMLWithTopics(String htmlData, TaskStatus taskStatus, Integer attempt, String oldJson) {
        try {
            if (attempt >= 3) {
                throw new VacademyException("No response from DeepSeek");
            }
            String extractedQuestionNumber = getCommaSeparatedQuestionNumbers(oldJson);
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE);
            Map<String, Object> promptMap = Map.of("htmlData", unTaggedHtml,
                    "extractedQuestionNumber", extractedQuestionNumber);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("deepseek/deepseek-chat-v3-0324:free", prompt.getContents().trim(), 30000);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson);
                return oldJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);


            String mergedJson = mergeQuestionsJson(oldJson, restored);

            if (getIsProcessCompleted(mergedJson)) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson);
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", mergedJson);
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLWithTopics(htmlData, taskStatus, attempt + 1, mergedJson);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson);
            return oldJson;
        }
    }
}