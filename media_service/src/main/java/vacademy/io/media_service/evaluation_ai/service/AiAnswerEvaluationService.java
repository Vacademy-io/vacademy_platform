package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekApiService;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.enums.TaskTypeEnum;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationRequestResponse;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationResultFromDeepSeek;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserDTO;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;
import vacademy.io.media_service.evaluation_ai.repository.UserEvaluationRepository;
import vacademy.io.media_service.repository.TaskStatusRepository;
import vacademy.io.media_service.service.FileConversionStatusService;
import vacademy.io.media_service.service.FileService;
import vacademy.io.media_service.service.NewDocConverterService;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiAnswerEvaluationService {

    private final FileService fileService;
    private final FileConversionStatusService fileConversionStatusService;
    private final NewDocConverterService newDocConverterService;
    private final DeepSeekApiService deepSeekApiService;
    private final TaskStatusRepository taskStatusRepository;
    private final AssessmentService assessmentService;
    private final AuthService userService;
    private final UserEvaluationRepository userEvaluationRepository;
    private final ObjectMapper objectMapper;

    public EvaluationRequestResponse evaluateAnswers(String assessmentId, List<EvaluationUserDTO> evaluationUsers) {
        AiEvaluationMetadata metadata = assessmentService.getAssessmentMetadata(assessmentId);
        String taskId = createNewTask(UUID.randomUUID().toString());
        EvaluationRequestResponse response = initializeResponse(taskId);

        log.info("Starting evaluation for assessmentId={}, usersCount={}", assessmentId, evaluationUsers.size());

        new Thread(() -> handleEvaluationInBackground(taskId, metadata, assessmentId, evaluationUsers)).start();

        return response;
    }

    private void handleEvaluationInBackground(String taskId, AiEvaluationMetadata metadata, String assessmentId, List<EvaluationUserDTO> users) {
        try {
            EvaluationResultFromDeepSeek resultContainer = prepareInitialEvaluationData();
            Set<String> processedUsers = new HashSet<>();

            for (EvaluationUserDTO user : users) {
                if (processedUsers.contains(user.getId())) continue;
                log.info("Processing user: {}", user.getId());
                processAndSaveUserEvaluation(user, metadata, assessmentId, resultContainer, processedUsers);
                finalizeEvaluationResults(taskId, resultContainer,TaskStatusEnum.PROCESSING.name());
            }
            finalizeEvaluationResults(taskId, resultContainer,TaskStatusEnum.COMPLETED.name());

        } catch (Exception e) {
            log.error("Evaluation failed for taskId={}", taskId, e);
            handleEvaluationFailure(taskId, e);
        }
    }

    private EvaluationResultFromDeepSeek prepareInitialEvaluationData() {
        EvaluationResultFromDeepSeek resultContainer = new EvaluationResultFromDeepSeek();
        resultContainer.setEvaluationResults(new HashSet<>());
        return resultContainer;
    }

    private void processAndSaveUserEvaluation(EvaluationUserDTO user, AiEvaluationMetadata metadata, String assessmentId,
                                              EvaluationResultFromDeepSeek resultContainer, Set<String> processedUsers) throws Exception {

        EvaluationResultFromDeepSeek.EvaluationResult evaluationResult = processSingleUser(user, metadata, assessmentId, processedUsers);
        resultContainer.getEvaluationResults().add(evaluationResult);

        UserDTO userDTO = userService.createOrGetExistingUser(createUserDTO(user));
        user.setId(userDTO.getId());

        String json = buildEvaluationJsonForUser(evaluationResult);
        createOrUpdateEvaluationUser(user.getId(), "ASSESSMENT", assessmentId, json);
        processedUsers.add(user.getId());
    }

    private void finalizeEvaluationResults(String taskId, EvaluationResultFromDeepSeek results,String status) throws Exception {
        objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(results);
        log.info("Finalizing taskId={}, results size={}", taskId, results.getEvaluationResults().size());
        updateTask(taskId, json, status);
    }

    private void handleEvaluationFailure(String taskId, Exception e) {
        updateTask(taskId, "Error occurred: " + e.getMessage(), TaskStatusEnum.FAILED.name());
    }

    private EvaluationRequestResponse initializeResponse(String taskId) {
        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(taskId);
        response.setStatus(TaskStatusEnum.PROCESSING.name());
        response.setResponse("");
        return response;
    }

    private EvaluationResultFromDeepSeek.EvaluationResult processSingleUser(EvaluationUserDTO user,
                                                                            AiEvaluationMetadata metadata,
                                                                            String assessmentId,
                                                                            Set<String> processedUsers) {
        try {
            String html = convertFileToHtml(user.getResponseId());
            String prompt = generatePromptForSingleUser(metadata, user, html);

            log.info("Prompt for userId={}:\n{}", user.getId(), prompt);

            return evaluateWithRetry(prompt, 5);
        } catch (Exception e) {
            log.error("Error processing user {}", user.getId(), e);
            throw new VacademyException("Error processing user " + user.getId() + ": " + e.getMessage());
        }
    }

    private UserDTO createUserDTO(EvaluationUserDTO user) {
        UserDTO dto = new UserDTO();
        dto.setUsername(generateUsername(user.getFullName()));
        dto.setPassword(generatePassword());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setId(user.getId());
        return dto;
    }

    private String buildEvaluationJsonForUser(EvaluationResultFromDeepSeek.EvaluationResult evaluationResult) throws Exception {
        objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(evaluationResult);
    }

    private String generatePromptForSingleUser(AiEvaluationMetadata metadata, EvaluationUserDTO user, String html) {
        try {
            ObjectMapper objectMapper1 = new ObjectMapper();
            String jsonAssessmentMetadata = objectMapper1.writeValueAsString(metadata);
            return String.format("""
        You are an AI examiner.

        A student has submitted answers for an assessment in HTML format.
        You are provided with:
        - The **assessment metadata** (includes original questions, structure, and marking scheme).
        - The **student's HTML answers**.

        Strict Rules:
        1. Only use questions from the `AiEvaluationMetadata`. **Ignore any student-written questions** in their HTML. The original questions are in `reach_text` field inside each question object.
        2. For each question, extract its evaluation **criteria** from the `marking_json` field and grade the answer accordingly.
        3. Maintain the `question_order` to match the original assessment sequence.
        4. Your output must follow the **JSON format below exactly**, using `snake_case` keys only.
        5. Do not include any additional fields. Do not repeat the full `marking_json`.

         Field Usage:
        - `assessmentName`: Title of the test.
        - `instruction`: Guidelines for attempting the test.
        - `sections`: Group of questions.
        - Each section has:
          - `name`: Section title.
          - `cutoffMarks`: Minimum marks to pass this section.
        - Each question has:
          - `reach_text`: The actual question to be evaluated.
          - `marking_json`: The subjective evaluation criteria. Use this to assign partial/full marks.

        Respond in this structure:

        {
          "user_id": "%s",
          "name": "%s",
          "email": "%s",
          "contact_number": "%s",
          "total_marks_obtained": <numeric>,
          "total_marks": <numeric>,
          "overall_verdict": "pass/fail/absent/etc.",
          "overall_description": "<brief summary>",
          "section_wise_results": [
            {
              "section_id": "<string>",
              "section_name": "<string>",
              "marks_obtained": <numeric>,
              "total_marks": <numeric>,
              "verdict": "pass/fail/null",
              "question_wise_results": [
                {
                  "question_id": "<string>",
                  "question_order": <number>,
                  "marks_obtained": <numeric>,
                  "total_marks": <numeric>,
                  "feedback": "<string>",
                  "description": "<string>",
                  "verdict": "correct/partially correct/incorrect/not attempted",
                  "question_text": "<string>"
                }
              ]
            }
          ]
        }

        =============================
        Assessment Metadata:
        %s

        Student HTML Answer:
        %s
        =============================
        """,
                    user.getId(),
                    user.getFullName(),
                    user.getEmail(),
                    user.getContactNumber(),
                    jsonAssessmentMetadata,
                    html
            );
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize assessment metadata", e);
        }
    }



    private EvaluationResultFromDeepSeek.EvaluationResult evaluateWithRetry(String prompt, int maxAttempts) {
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.info("Attempt {} to call DeepSeek", attempt);
                String rawResponse = getEvaluationFromAI(prompt);
                String cleanedJson = cleanJsonMarkdown(rawResponse);
                return objectMapper.readValue(cleanedJson, EvaluationResultFromDeepSeek.EvaluationResult.class);
            } catch (Exception e) {
                log.warn("DeepSeek call failed on attempt {}: {}", attempt, e.getMessage());
                if (attempt == maxAttempts) {
                    log.error("Max attempts reached. Failing evaluation.");
                    throw new VacademyException("Failed after " + maxAttempts + " attempts. " + e.getMessage());
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Thread interrupted during retry", ie);
                }
            }
        }
        return null;
    }

    private String getEvaluationFromAI(String prompt) {
        DeepSeekResponse response = deepSeekApiService.getChatCompletion(
                "deepseek/deepseek-chat-v3-0324:free", prompt, 3000
        );
        return response.getChoices().get(0).getMessage().getContent();
    }

    private String convertFileToHtml(String pdfId) {
        var fileStatus = fileConversionStatusService.findByVendorFileId(pdfId);
        String html = newDocConverterService.getConvertedHtml(pdfId);
        if (html == null) throw new VacademyException("File Still Processing");
        return extractBody(html);
    }

    public static String extractBody(String html) {
        if (!StringUtils.hasText(html)) return "";
        Pattern pattern = Pattern.compile("<body[^>]*>(.*?)</body>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1).trim() : html;
    }

    public String createNewTask(String inputId) {
        TaskStatus task = new TaskStatus();
        task.setType(TaskTypeEnum.EVALUATION.name());
        task.setStatus(TaskStatusEnum.PROCESSING.name());
        task.setInputId(inputId);
        task.setId(UUID.randomUUID().toString());
        task.setInputType("ASSESSMENT_EVALUATION");
        task.setResultJson("");
        return taskStatusRepository.save(task).getId();
    }

    public String updateTask(String taskId, String resultJson, String status) {
        TaskStatus task = taskStatusRepository.findById(taskId)
                .orElseThrow(() -> new VacademyException("Task not found"));
        task.setStatus(status);
        System.out.println(resultJson);
        task.setResultJson(resultJson);
        return taskStatusRepository.save(task).getId();
    }

    public EvaluationRequestResponse getTaskUpdate(String taskId) {
        TaskStatus task = taskStatusRepository.findById(taskId)
                .orElseThrow(() -> new VacademyException("Task not found"));
        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(task.getId());
        response.setStatus(task.getStatus());
        response.setResponse(task.getResultJson());
        return response;
    }

    private void createOrUpdateEvaluationUser(String userId, String source, String sourceId, String responseJson) {
        EvaluationUser evaluationUser = userEvaluationRepository
                .findBySourceTypeAndSourceIdAndUserId(source, sourceId, userId)
                .orElse(new EvaluationUser());

        evaluationUser.setUserId(userId);
        evaluationUser.setSourceId(sourceId);
        evaluationUser.setSourceType(source);
        evaluationUser.setResponseJson(responseJson);
        userEvaluationRepository.save(evaluationUser);
    }

    private String generateUsername(String fullName) {
        String namePart = fullName.replaceAll("\\s+", "").substring(0, Math.min(fullName.length(), 4)).toLowerCase();
        if (namePart.length() < 4) namePart = String.format("%-4s", namePart).replace(' ', 'X');
        return namePart + RandomStringUtils.randomNumeric(4);
    }

    private String generatePassword() {
        return RandomStringUtils.randomAlphanumeric(8);
    }

    public String cleanJsonMarkdown(String raw) {
        return raw
                .replaceAll("(?i)^```json\\s*", "")
                .replaceAll("```$", "")
                .trim();
    }
}
