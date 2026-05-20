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
import org.springframework.util.StringUtils;
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
public class ExternalAIApiService {

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("<!--DEEPSEEK_PLACEHOLDER_(\\d+)-->");
    private final ChatModel chatModel;
    @Autowired
    TaskStatusService taskStatusService;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private ExternalAIApiServiceImpl deepSeekApiService;

    @Autowired
    private GeminiImageGenerationService geminiImageGenerationService;

    @Autowired
    public ExternalAIApiService(ChatModel chatModel) {
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
     * 2. Converting Unicode escape sequences like \u003c to corresponding
     * characters
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
                return "None";
            }

            List<String> questionNumbers = new ArrayList<>();
            for (JsonNode question : questionsNode) {
                String number = question.get("question_number").asText();
                questionNumbers.add(number);
            }

            return String.join(",", questionNumbers);
        } catch (Exception e) {
            e.printStackTrace();
            return "None";
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

            // Merge is_process_completed: once true, stay true. A later chunk
            // that omits the field (or contains only partial data like tags)
            // must not regress a previously-completed task back to false.
            boolean oldCompleted = oldNode.has("is_process_completed")
                    && oldNode.get("is_process_completed").asBoolean();
            boolean newCompleted = newNode.has("is_process_completed")
                    && newNode.get("is_process_completed").asBoolean();
            mergedNode.put("is_process_completed", oldCompleted || newCompleted);

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

    private static void mergeStringArrayField(ObjectNode mergedNode, JsonNode oldNode, JsonNode newNode,
            String fieldName, ObjectMapper mapper) {
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

    public String getQuestionsWithDeepSeekFromTextPrompt(String textPrompt, String numberOfQuestions,
            String typeOfQuestion, String classLevel, String topics, String language, TaskStatus taskStatus,
            Integer attempt, String oldJson, String model, Boolean generateImage) {
        try {
            if (attempt >= 4)
                return oldJson;
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(oldJson);
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(textPrompt);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.TEXT_TO_QUESTIONS);
            String existingQuestions = allQuestionNumbers;
            String continuationInstruction = (!StringUtils.hasText(allQuestionNumbers)
                    || "None".equalsIgnoreCase(allQuestionNumbers))
                            ? "Start from beginning"
                            : ("Continue for question other than " + allQuestionNumbers + " if needed");

            String imageInstruction = Boolean.TRUE.equals(generateImage)
                    ? ConstantAiTemplate.getImageGenerationInstruction()
                    : "";

            Map<String, Object> promptMap = Map.of(
                    "textPrompt", textPrompt,
                    "numberOfQuestions", numberOfQuestions,
                    "typeOfQuestion", typeOfQuestion,
                    "classLevel", classLevel,
                    "topics", topics,
                    "language", language,
                    "allQuestionNumbers", allQuestionNumbers,
                    "existingQuestions", existingQuestions,
                    "continuationInstruction", continuationInstruction,
                    "imageInstruction", imageInstruction);

            Prompt prompt = new PromptTemplate(template).create(promptMap);
            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion(model, prompt.getContents().trim(), 30000,
                    "questions", getInstituteUUID(taskStatus), null);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson,
                        "No Response Generate");
                return oldJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);

            String mergedJson = mergeQuestionsJson(oldJson, restored);

            if (getIsProcessCompleted(mergedJson)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                mergedJson = cleanInvalidQuestionsFromJson(mergedJson);
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson,
                        "Questions Generated");
                return mergedJson;
            }
            if (getQuestionCount(mergedJson) >= Integer.parseInt(numberOfQuestions)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                mergedJson = cleanInvalidQuestionsFromJson(mergedJson);
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson,
                        "Questions Generated");
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), mergedJson,
                    "Questions Generating");

            return getQuestionsWithDeepSeekFromTextPrompt(textPrompt, numberOfQuestions, typeOfQuestion, classLevel,
                    topics, language, taskStatus, attempt + 1, mergedJson, model, generateImage);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson, e.getMessage());
            return oldJson;
        }
    }

    public QuestionMetadataExtractorResponse getQuestionsMetadata(QuestionMetadataExtractorRequest request) {

        try {

            var previewIdAndQuestionTextCompressed = getPreviewIdAndQuestionTextCompressed(request);

            String questionIdAndTextPrompt = previewIdAndQuestionTextCompressed.entrySet().stream()
                    .map(e -> "question_id:" + e.getKey() + " text : " + e.getValue())
                    .collect(Collectors.joining("\n"));
            String topicIdAndNamePrompt = request.getIdAndTopics().entrySet().stream()
                    .map(e -> "topic_id:" + e.getKey() + " name : " + e.getValue()).collect(Collectors.joining("\n"));

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.EXTRACT_QUESTION_METADATA);

            Map<String, Object> promptMap = Map.of("idAndQuestions", questionIdAndTextPrompt, "idAndTopics",
                    topicIdAndNamePrompt);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                    prompt.getContents().trim(), 30000);

            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                throw new Exception("Failed to get response from deepseek");
            }

            String validJson = JsonUtils.extractAndSanitizeJson(response.getChoices().get(0).getMessage().getContent());
            QuestionMetadataExtractorResponse objectResponse = objectMapper.readValue(validJson,
                    new TypeReference<QuestionMetadataExtractorResponse>() {
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

    public String getQuestionsWithDeepSeekFromHTML(String htmlData, String userPrompt, Boolean generateImage) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

        if (userPrompt == null) {
            userPrompt = "Include first 20 questions in the response. Do not truncate or omit any questions.";
        }

        String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.HTML_TO_QUESTIONS);

        String imageInstruction = Boolean.TRUE.equals(generateImage)
                ? ConstantAiTemplate.getImageGenerationInstruction()
                : "";

        Prompt prompt = new PromptTemplate(template).create(
                Map.of("htmlData", unTaggedHtml, "userPrompt", userPrompt, "imageInstruction", imageInstruction));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                prompt.getContents().trim(), 30000);
        if (response.getChoices().isEmpty()) {
            throw new VacademyException("No response from DeepSeek");
        }
        String resultJson = response.getChoices().get(0).getMessage().getContent();
        String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
        try {
            String restoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);

            // Process Image Generation
            if (Boolean.TRUE.equals(generateImage)) {
                restoredJson = processAndGenerateImages(restoredJson);
            }

            return restoredJson;
        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }

    public String getQuestionsWithDeepSeekFromHTMLRecursive(String htmlData, String userPrompt, String restoredJson,
            int attempt, TaskStatus taskStatus, Boolean generateImage) {
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

            String imageInstruction = Boolean.TRUE.equals(generateImage)
                    ? ConstantAiTemplate.getImageGenerationInstruction()
                    : "";

            Map<String, Object> promptMap = Map.of(
                    "htmlData", unTaggedHtml,
                    "userPrompt", userPrompt,
                    "allQuestionNumbers", allQuestionNumbers,
                    "imageInstruction", imageInstruction);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                    prompt.getContents().trim(), 30000, "questions", getInstituteUUID(taskStatus), null);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson,
                        "No Response Generate");
                return restoredJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);

            String mergedJson = mergeQuestionsJson(restoredJson, restored);

            if (getIsProcessCompleted(mergedJson)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson,
                        "Questions Generated");
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", restoredJson, "Questions Generating");
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLRecursive(htmlData, userPrompt, mergedJson, attempt + 1, taskStatus,
                    generateImage);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson, e.getMessage());
            throw new RuntimeException(e);
        }
    }

    public String getQuestionsWithDeepSeekFromHTMLOfTopics(String htmlData, String requiredTopics, String restoredJson,
            Integer attempt, TaskStatus taskStatus, Boolean generateImage) {
        try {
            if (attempt >= 5) {
                if (restoredJson == null || restoredJson.isEmpty()) {
                    taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson,
                            "No Response Generate");
                }
                return restoredJson != null ? restoredJson : "";
            }
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(restoredJson);
            String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.PDF_TO_QUESTIONS_WITH_TOPIC);

            String imageInstruction = Boolean.TRUE.equals(generateImage)
                    ? ConstantAiTemplate.getImageGenerationInstruction()
                    : "";

            Map<String, Object> promptMap = Map.of("htmlData", unTaggedHtml,
                    "requiredTopics", requiredTopics,
                    "allQuestionNumbers", allQuestionNumbers,
                    "restoredJson", restoredJson == null ? "" : restoredJson,
                    "imageInstruction", imageInstruction);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                    prompt.getContents().trim(), 30000, "questions", getInstituteUUID(taskStatus), null);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson,
                        "No Response Generate");
                return restoredJson;
            }

            if (!StringUtils.hasText(response.getChoices().get(0).getMessage().getContent())) {
                return getQuestionsWithDeepSeekFromHTMLOfTopics(htmlData, requiredTopics, restoredJson, attempt + 1,
                        taskStatus, generateImage);
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);
            String newRestoredJson = htmlJsonProcessor.restoreTagsInJson(validJson);

            String mergedJson = mergeQuestionsJson(restoredJson, newRestoredJson);

            if (getIsProcessCompleted(mergedJson)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                taskStatusService.updateTaskStatus(taskStatus, null, mergedJson, "Questions Generated");
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", restoredJson, "Questions Generating");
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLOfTopics(htmlData, requiredTopics, mergedJson, attempt + 1,
                    taskStatus, generateImage);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), restoredJson, e.getMessage());
            throw new RuntimeException(e);
        }
    }

    public String evaluateManualAnswerSheet(String htmlAnswerData, String htmlQuestionData, Double maxMarks,
            String evaluationDifficulty) {
        HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
        String unTaggedHtml = htmlJsonProcessor.removeTags(htmlAnswerData);

        String template = """


                """;

        Prompt prompt = new PromptTemplate(template).create(Map.of("htmlQuestionData", htmlQuestionData,
                "htmlAnswerData", htmlAnswerData, "maxMarks", maxMarks, "evaluationDifficulty", evaluationDifficulty));

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                prompt.getContents().trim(), 30000);
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

    public String getQuestionsWithDeepSeekFromAudio(String audioString, String difficulty, String numQuestions,
            String optionalPrompt, String oldResponse, int attempt, TaskStatus taskStatus, Boolean generateImage) {
        try {
            if (attempt >= 5) {
                return oldResponse;
            }
            String allQuestionNumbers = getCommaSeparatedQuestionNumbers(oldResponse);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.AUDIO_TO_QUESTIONS);

            String imageInstruction = Boolean.TRUE.equals(generateImage)
                    ? ConstantAiTemplate.getImageGenerationInstruction()
                    : "";

            Map<String, Object> promptMap = Map.of("classLecture", audioString, "difficulty", difficulty,
                    "numQuestions", numQuestions, "optionalPrompt", optionalPrompt, "language", "en",
                    "allQuestionNumbers", allQuestionNumbers,
                    "imageInstruction", imageInstruction);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                    prompt.getContents().trim(), 30000, "questions", getInstituteUUID(taskStatus), null);

            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldResponse,
                        "No Response Generate");
                return oldResponse;
            }
            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String mergedJson = mergeQuestionsJson(oldResponse, validJson);

            int currentQuestionCount = getQuestionCount(mergedJson);
            log.info("MergedJson: " + mergedJson);
            log.info("Total Questions: " + currentQuestionCount);

            if (getIsProcessCompleted(mergedJson)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", mergedJson, "Questions Generated");
                return mergedJson;
            }

            if (!Objects.isNull(numQuestions) && !numQuestions.isEmpty()
                    && currentQuestionCount >= Integer.parseInt(numQuestions)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                taskStatusService.updateTaskStatus(taskStatus, "COMPLETED", mergedJson, "Questions Generated");
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", mergedJson, "Questions Generating");
            return getQuestionsWithDeepSeekFromAudio(audioString, difficulty, numQuestions, optionalPrompt, mergedJson,
                    attempt + 1, taskStatus, generateImage);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldResponse, e.getMessage());
            return oldResponse;
        }
    }

    /**
     * Cleans the merged JSON before it is persisted to result_json. For each
     * question we (1) attempt simple structural repairs of the LLM's most
     * common breakages, then (2) validate the repaired node against the same
     * rules used by the read-path lenient parser. Repaired-and-valid questions
     * are kept; broken-beyond-repair questions are dropped with a warn log.
     *
     * On any unexpected error this falls back to the input string so the
     * write path can never get worse than the previous unvalidated behavior.
     */
    String cleanInvalidQuestionsFromJson(String mergedJson) {
        if (mergedJson == null || mergedJson.isEmpty()) {
            return mergedJson;
        }
        try {
            JsonNode root = objectMapper.readTree(mergedJson);
            if (root == null || !root.isObject()) {
                return mergedJson;
            }
            JsonNode questionsNode = root.get("questions");
            if (questionsNode == null || !questionsNode.isArray()) {
                return mergedJson;
            }
            ArrayNode cleaned = objectMapper.createArrayNode();
            int repaired = 0;
            int dropped = 0;
            int index = 0;
            for (JsonNode original : questionsNode) {
                index++;
                JsonNode q = original;
                boolean wasRepaired = false;
                if (original.isObject()) {
                    ObjectNode copy = (ObjectNode) original.deepCopy();
                    if (repairQuestionNode(copy)) {
                        q = copy;
                        wasRepaired = true;
                    }
                }
                try {
                    AiGeneratedQuestionJsonDto dto = objectMapper.treeToValue(
                            q, AiGeneratedQuestionJsonDto.class);
                    if (dto != null
                            && dto.getQuestion() != null
                            && dto.getQuestion().getContent() != null
                            && !dto.getQuestion().getContent().trim().isEmpty()
                            && dto.getQuestionType() != null) {
                        cleaned.add(q);
                        if (wasRepaired) {
                            repaired++;
                            log.info("Repaired schema-invalid question at index {} before persist", index);
                        }
                    } else {
                        dropped++;
                        log.warn("Dropping question at index {} before persist: missing required fields after repair", index);
                    }
                } catch (Exception ex) {
                    dropped++;
                    log.warn("Dropping question at index {} before persist: {}", index, ex.getMessage());
                }
            }
            if (repaired == 0 && dropped == 0) {
                return mergedJson;
            }
            ((ObjectNode) root).set("questions", cleaned);
            log.info("cleanInvalidQuestionsFromJson summary: repaired={} dropped={} kept={}",
                    repaired, dropped, cleaned.size());
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.warn("cleanInvalidQuestionsFromJson failed; persisting raw output. err={}", e.getMessage());
            return mergedJson;
        }
    }

    /**
     * Attempts in-place structural repairs of a single question node against
     * the AiGeneratedQuestionJsonDto schema. Returns true when any repair
     * was applied, false when the node was already well-formed.
     *
     * Repairs:
     *  - question: "text"           -> { "type": "HTML", "content": "text" }
     *  - options: ["a","b",...]     -> [ {type:HTML, preview_id:"1", content:"a"}, ... ]
     *  - correct_options: "x"       -> ["x"]
     *  - question_type null/missing -> "MCQS" when options array is non-empty
     *
     * Things we do NOT attempt to repair (we let validation drop them):
     *  - options: "bare string"     -> no underlying array, unrecoverable
     *  - question: ""               -> empty content, validation will drop
     */
    private boolean repairQuestionNode(ObjectNode q) {
        boolean changed = false;

        JsonNode questionField = q.get("question");
        if (questionField != null && questionField.isTextual()) {
            ObjectNode wrapped = objectMapper.createObjectNode();
            wrapped.put("type", "HTML");
            wrapped.put("content", questionField.asText());
            q.set("question", wrapped);
            changed = true;
        } else if (questionField != null && questionField.isObject()
                && !questionField.has("type")) {
            ((ObjectNode) questionField).put("type", "HTML");
            changed = true;
        }

        JsonNode optionsField = q.get("options");
        if (optionsField != null && optionsField.isArray()) {
            ArrayNode normalizedOptions = objectMapper.createArrayNode();
            boolean optionsChanged = false;
            int i = 0;
            for (JsonNode opt : optionsField) {
                i++;
                if (opt.isTextual()) {
                    ObjectNode wrapped = objectMapper.createObjectNode();
                    wrapped.put("type", "HTML");
                    wrapped.put("preview_id", String.valueOf(i));
                    wrapped.put("content", opt.asText());
                    normalizedOptions.add(wrapped);
                    optionsChanged = true;
                } else if (opt.isObject()) {
                    ObjectNode optObj = (ObjectNode) opt.deepCopy();
                    if (!optObj.has("type")) {
                        optObj.put("type", "HTML");
                        optionsChanged = true;
                    }
                    if (!optObj.has("preview_id") || optObj.get("preview_id").isNull()
                            || optObj.get("preview_id").asText().isEmpty()) {
                        optObj.put("preview_id", String.valueOf(i));
                        optionsChanged = true;
                    }
                    normalizedOptions.add(optObj);
                } else {
                    // Non-text, non-object option element — skip silently.
                    optionsChanged = true;
                }
            }
            if (optionsChanged) {
                q.set("options", normalizedOptions);
                changed = true;
            }
        }

        JsonNode correctOptionsField = q.get("correct_options");
        if (correctOptionsField != null && correctOptionsField.isTextual()) {
            ArrayNode arr = objectMapper.createArrayNode();
            arr.add(correctOptionsField.asText());
            q.set("correct_options", arr);
            changed = true;
        }

        // question_type default: only when the signal is unambiguous (exactly
        // one correct option). For MCQM, defaulting to MCQS would mis-grade.
        // For 0 or 2+ correct options, leave it null so validation drops the
        // question rather than risk persisting a wrong type.
        JsonNode typeField = q.get("question_type");
        boolean typeMissing = typeField == null || typeField.isNull()
                || typeField.asText().isEmpty();
        JsonNode optionsNow = q.get("options");
        JsonNode correctNow = q.get("correct_options");
        if (typeMissing
                && optionsNow != null && optionsNow.isArray() && optionsNow.size() >= 2
                && correctNow != null && correctNow.isArray() && correctNow.size() == 1) {
            q.put("question_type", "MCQS");
            changed = true;
        }

        return changed;
    }

    public List<QuestionDTO> formatQuestions(AiGeneratedQuestionJsonDto[] questions) {
        List<QuestionDTO> formattedQuestions = new ArrayList<>();
        if (questions == null || questions.length == 0) {
            return formattedQuestions;
        }

        int index = 0;
        for (AiGeneratedQuestionJsonDto question : questions) {
            index++;
            try {
                if (question == null
                        || question.getQuestion() == null
                        || question.getQuestion().getContent() == null
                        || question.getQuestion().getContent().trim().isEmpty()
                        || question.getQuestionType() == null) {
                    log.warn("Skipping question at index {}: missing required fields", index);
                    continue;
                }
                String questionContent = unescapeString(question.getQuestion().getContent());
                question.getQuestion().setContent(questionContent);
                switch (question.getQuestionType()) {
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
                        log.warn("Skipping question at index {}: unsupported type {}",
                                index, question.getQuestionType());
                }
            } catch (Exception e) {
                log.warn("Skipping question at index {}: {}", index, e.getMessage());
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

        // Process Options first so we can validate correct-option indices against them
        List<AiGeneratedQuestionJsonDto.Option> mcqsOptions = questionRequest.getOptions();
        List<String> previewIds = new ArrayList<>();
        if (mcqsOptions != null) {
            for (int i = 0; i < mcqsOptions.size(); i++) {
                AiGeneratedQuestionJsonDto.Option optionDTO = mcqsOptions.get(i);
                if (optionDTO == null || optionDTO.getContent() == null) continue;
                String previewId = optionDTO.getPreview_id();
                if (previewId == null || previewId.isEmpty()) {
                    previewId = String.valueOf(i + 1);
                }
                previewIds.add(previewId);
                question.getOptions().add(new OptionDTO(previewId,
                        new AssessmentRichTextDataDTO(null, "HTML", unescapeString(optionDTO.getContent()))));
            }
        }

        // Initialize Evaluation with validated correct option ids
        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQS.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();
        mcqData.setCorrectOptionIds(normalizeCorrectOptionIds(questionRequest.getCorrectOptions(), previewIds));
        requestEvaluation.setData(mcqData);

        try {
            question.setAutoEvaluationJson(setEvaluationJson(requestEvaluation));
        } catch (Exception e) {
            throw new VacademyException("Failed to process question settings" + e.getMessage());
        }

        return question;
    }

    /**
     * Normalize raw correct-option markers to the actual option preview ids.
     * Handles: nulls, letter labels (A/B/C → first/second/…), indices outside
     * the options size, and duplicates. Returns only ids that exist in previewIds.
     */
    private List<String> normalizeCorrectOptionIds(List<String> raw, List<String> previewIds) {
        if (raw == null || raw.isEmpty() || previewIds == null || previewIds.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> normalized = new ArrayList<>();
        for (String marker : raw) {
            if (marker == null) continue;
            String trimmed = marker.trim();
            if (trimmed.isEmpty()) continue;
            String candidate = null;
            if (trimmed.length() == 1) {
                char c = trimmed.charAt(0);
                if (c >= 'A' && c <= 'Z') {
                    int idx = c - 'A';
                    if (idx < previewIds.size()) candidate = previewIds.get(idx);
                } else if (c >= 'a' && c <= 'z') {
                    int idx = c - 'a';
                    if (idx < previewIds.size()) candidate = previewIds.get(idx);
                }
            }
            if (candidate == null && previewIds.contains(trimmed)) {
                candidate = trimmed;
            }
            if (candidate == null) {
                try {
                    int parsed = Integer.parseInt(trimmed);
                    if (parsed >= 1 && parsed <= previewIds.size()) {
                        candidate = previewIds.get(parsed - 1);
                    }
                } catch (NumberFormatException ignored) {
                    // fall through
                }
            }
            if (candidate != null && !normalized.contains(candidate)) {
                normalized.add(candidate);
            }
        }
        return normalized;
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

        // Process Options first
        List<AiGeneratedQuestionJsonDto.Option> mcqmOptions = questionRequest.getOptions();
        List<String> previewIds = new ArrayList<>();
        if (mcqmOptions != null) {
            for (int i = 0; i < mcqmOptions.size(); i++) {
                AiGeneratedQuestionJsonDto.Option optionDTO = mcqmOptions.get(i);
                if (optionDTO == null || optionDTO.getContent() == null) continue;
                String previewId = optionDTO.getPreview_id();
                if (previewId == null || previewId.isEmpty()) {
                    previewId = String.valueOf(i + 1);
                }
                previewIds.add(previewId);
                question.getOptions().add(new OptionDTO(previewId,
                        new AssessmentRichTextDataDTO(null, "HTML", unescapeString(optionDTO.getContent()))));
            }
        }

        MCQEvaluationDTO requestEvaluation = new MCQEvaluationDTO();
        requestEvaluation.setType(QuestionTypes.MCQM.name());
        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();
        mcqData.setCorrectOptionIds(normalizeCorrectOptionIds(questionRequest.getCorrectOptions(), previewIds));
        requestEvaluation.setData(mcqData);

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

    public String getQuestionsWithDeepSeekFromHTMLWithTopics(String htmlData, TaskStatus taskStatus, Integer attempt,
            String oldJson, Boolean generateImage) {
        try {
            if (attempt >= 3) {
                throw new VacademyException("No response from DeepSeek");
            }
            String extractedQuestionNumber = getCommaSeparatedQuestionNumbers(oldJson);
            HtmlJsonProcessor htmlJsonProcessor = new HtmlJsonProcessor();
            String unTaggedHtml = htmlJsonProcessor.removeTags(htmlData);

            String template = ConstantAiTemplate.getTemplateBasedOnType(TaskStatusTypeEnum.SORT_QUESTIONS_TOPIC_WISE);

            String imageInstruction = Boolean.TRUE.equals(generateImage)
                    ? ConstantAiTemplate.getImageGenerationInstruction()
                    : "";

            Map<String, Object> promptMap = Map.of("htmlData", unTaggedHtml,
                    "extractedQuestionNumber", extractedQuestionNumber,
                    "imageInstruction", imageInstruction);

            Prompt prompt = new PromptTemplate(template).create(promptMap);

            taskStatusService.convertMapToJsonAndStore(promptMap, taskStatus);

            DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                    prompt.getContents().trim(), 30000, "questions", getInstituteUUID(taskStatus), null);
            if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson,
                        "No Response Generate");
                return oldJson;
            }

            String resultJson = response.getChoices().get(0).getMessage().getContent();
            String validJson = JsonUtils.extractAndSanitizeJson(resultJson);

            String restored = htmlJsonProcessor.restoreTagsInJson(validJson);

            String mergedJson = mergeQuestionsJson(oldJson, restored);

            if (getIsProcessCompleted(mergedJson)) {

                // Process Image Generation
                if (Boolean.TRUE.equals(generateImage)) {
                    mergedJson = processAndGenerateImages(mergedJson);
                }

                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), mergedJson,
                        "Questions Generated");
                return mergedJson;
            }

            taskStatusService.updateTaskStatus(taskStatus, "PROGRESS", mergedJson, "Questions Generating");
            // Recurse for remaining questions
            return getQuestionsWithDeepSeekFromHTMLWithTopics(htmlData, taskStatus, attempt + 1, mergedJson,
                    generateImage);
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), oldJson, e.getMessage());
            return oldJson;
        }
    }

    private String processAndGenerateImages(String jsonString) {
        try {
            JsonNode root = objectMapper.readTree(jsonString);
            boolean modified = false;

            JsonNode questions = root.path("questions");
            if (questions.isArray()) {
                for (JsonNode q : questions) {
                    if (q.has("question")) {
                        modified |= processContentForImage(q.get("question"));
                    }
                    JsonNode options = q.path("options");
                    if (options.isArray()) {
                        for (JsonNode opt : options) {
                            modified |= processContentForImage(opt);
                        }
                    }
                }
            }

            if (modified) {
                return objectMapper.writeValueAsString(root);
            }
            return jsonString;

        } catch (Exception e) {
            log.error("Error processing text for image generation", e);
            return jsonString;
        }
    }

    private boolean processContentForImage(JsonNode contentNode) {
        if (contentNode.has("content")) {
            String content = contentNode.get("content").asText();
            if (content.contains("image_to_generate")) {
                // Use regex to find and replace
                String regex = "<div class=\"image_to_generate\">PROMPT: (.*?)</div>";
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex).matcher(content);
                StringBuffer sb = new StringBuffer();
                boolean matches = false;
                while (matcher.find()) {
                    matches = true;
                    String prompt = matcher.group(1);
                    String url = geminiImageGenerationService.generateAndUploadImage(prompt);
                    if (url != null) {
                        matcher.appendReplacement(sb,
                                "<img src=\"" + url + "\" style=\"width:100%; object-fit:contain;\"/>");
                    } else {
                        // Failed to generate, remove the div
                        matcher.appendReplacement(sb, "");
                    }
                }
                matcher.appendTail(sb);
                if (matches) {
                    ((ObjectNode) contentNode).put("content", sb.toString());
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Helper method to extract institute UUID from TaskStatus.
     * Returns null if taskStatus or instituteId is null.
     */
    private UUID getInstituteUUID(TaskStatus taskStatus) {
        if (taskStatus == null || taskStatus.getInstituteId() == null) {
            return null;
        }
        try {
            return UUID.fromString(taskStatus.getInstituteId());
        } catch (IllegalArgumentException e) {
            log.warn("Invalid institute ID format: {}", taskStatus.getInstituteId());
            return null;
        }
    }
}