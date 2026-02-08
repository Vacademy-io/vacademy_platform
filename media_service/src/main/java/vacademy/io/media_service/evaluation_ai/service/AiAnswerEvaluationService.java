// Filename: AiAnswerEvaluationService.java
package vacademy.io.media_service.evaluation_ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.RandomStringUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;
import vacademy.io.common.ai.dto.AiEvaluationQuestionDTO;
import vacademy.io.common.ai.dto.AiEvaluationSectionDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.ExternalAIApiServiceImpl;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.entity.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskTypeEnum;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationRequestResponse;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationResultFromDeepSeek;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserDTO;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;
import vacademy.io.media_service.evaluation_ai.enums.EvaluationStepsStatusEnum;
import vacademy.io.media_service.evaluation_ai.enums.EvaluationUserSourceEnum;
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
    private final ExternalAIApiServiceImpl deepSeekApiService;
    private final TaskStatusRepository taskStatusRepository;
    private final AssessmentService assessmentService;
    private final AuthService userService;
    private final UserEvaluationRepository userEvaluationRepository;
    private final ObjectMapper objectMapper;

    public static String extractBody(String html) {
        if (!StringUtils.hasText(html))
            return "";
        Pattern pattern = Pattern.compile("<body[^>]*>(.*?)</body>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1).trim() : html;
    }

    public EvaluationRequestResponse evaluateAnswers(String assessmentId, List<EvaluationUserDTO> evaluationUsers) {
        log.info("Initiating evaluation for assessmentId={}, usersCount={}", assessmentId, evaluationUsers.size());

        AiEvaluationMetadata metadata = assessmentService.getAssessmentMetadata(assessmentId);
        log.info("Retrieved assessment metadata: {}", parseObjectToString(metadata));

        String taskId = createNewTask(UUID.randomUUID().toString());
        log.info("Created new evaluation task with taskId={}", taskId);

        EvaluationRequestResponse response = initializeResponse(taskId, evaluationUsers);
        response.setStatus(TaskStatusEnum.PROCESSING.name());

        List<EvaluationResultFromDeepSeek.EvaluationData> evaluationData = createEvaluationResultFromUsers(
                evaluationUsers);
        log.info("Prepared evaluation data for users: {}", parseObjectToString(evaluationData));

        EvaluationResultFromDeepSeek evaluationResultFromDeepSeek = new EvaluationResultFromDeepSeek();
        evaluationResultFromDeepSeek.setEvaluationData(new HashSet<>(evaluationData));
        String responseJson = parseObjectToString(evaluationResultFromDeepSeek);
        log.debug("Initial DeepSeek evaluation JSON payload: {}", responseJson);

        response.setResponse(responseJson);

        new Thread(() -> handleEvaluationInBackground(taskId, metadata, assessmentId, evaluationResultFromDeepSeek,
                evaluationData)).start();

        return response;
    }

    private void handleEvaluationInBackground(String taskId, AiEvaluationMetadata metadata, String assessmentId,
            EvaluationResultFromDeepSeek evaluationResultFromDeepSeek,
            List<EvaluationResultFromDeepSeek.EvaluationData> evaluationData) {
        try {
            for (int i = 0; i < evaluationData.size(); i++) {
                processAndSaveUserEvaluation(evaluationData.get(i), metadata, assessmentId,
                        evaluationResultFromDeepSeek, taskId);
            }
            finalizeEvaluationResults(taskId, evaluationResultFromDeepSeek);
        } catch (Exception e) {
            log.error("Evaluation failed for taskId={}", taskId, e);
            handleEvaluationFailure(taskId, e);
        }
    }

    private void processAndSaveUserEvaluation(EvaluationResultFromDeepSeek.EvaluationData evaluationData,
            AiEvaluationMetadata metadata,
            String assessmentId,
            EvaluationResultFromDeepSeek resultContainer,
            String taskId) throws Exception {
        log.info("Processing evaluation for user: {}", evaluationData.getUserId());

        String htmlAnswer = fetchHtmlAnswer(evaluationData);
        log.debug("Fetched HTML answer for userId={}: {}", evaluationData.getUserId(), htmlAnswer);

        extractAndSetAnswers(evaluationData, metadata, resultContainer, taskId, htmlAnswer);
        saveEvaluationToDb(evaluationData, assessmentId);
        log.debug("Extracted section-wise answers for userId={}: {}", evaluationData.getUserId(),
                parseObjectToString(evaluationData.getSectionWiseAnsExtracted()));

        evaluateAndSetResults(evaluationData, metadata, resultContainer, taskId);
        saveEvaluationToDb(evaluationData, assessmentId);
        log.debug("Evaluated answers for userId={}: {}", evaluationData.getUserId(),
                parseObjectToString(evaluationData.getEvaluationResult()));

    }

    private String fetchHtmlAnswer(EvaluationResultFromDeepSeek.EvaluationData evaluationData) throws Exception {
        return convertFileToHtml(evaluationData.getResponseId());
    }

    private void extractAndSetAnswers(EvaluationResultFromDeepSeek.EvaluationData evaluationData,
            AiEvaluationMetadata metadata,
            EvaluationResultFromDeepSeek resultContainer,
            String taskId,
            String htmlAnswer) {
        evaluationData.setStatus(EvaluationStepsStatusEnum.EXTRACTING_ANSWER.name());
        updateTask(taskId, parseObjectToString(resultContainer), TaskStatusEnum.PROCESSING.name());

        List<EvaluationResultFromDeepSeek.SectionWiseAnsExtracted> extracted = extractSectionWiseAns(
                metadata.getSections(), htmlAnswer);
        evaluationData.setSectionWiseAnsExtracted(extracted);
    }

    private void evaluateAndSetResults(EvaluationResultFromDeepSeek.EvaluationData evaluationData,
            AiEvaluationMetadata metadata,
            EvaluationResultFromDeepSeek resultContainer,
            String taskId) throws Exception {
        evaluationData.setStatus(EvaluationStepsStatusEnum.EVALUATING.name());
        updateTask(taskId, parseObjectToString(resultContainer), TaskStatusEnum.PROCESSING.name());

        EvaluationResultFromDeepSeek.EvaluationResult result = evaluateAnswers(
                evaluationData.getSectionWiseAnsExtracted(), metadata);
        evaluationData.setEvaluationResult(result);
        evaluationData.setStatus(EvaluationStepsStatusEnum.EVALUATION_COMPLETED.name());

        resultContainer.getEvaluationData().add(evaluationData);
        updateTask(taskId, parseObjectToString(resultContainer), TaskStatusEnum.PROCESSING.name());
    }

    private void saveEvaluationToDb(EvaluationResultFromDeepSeek.EvaluationData evaluationData, String assessmentId) {
        createOrUpdateEvaluationUser(
                evaluationData.getUserId(),
                EvaluationUserSourceEnum.ASSESSMENT_EVALUATION.name(),
                assessmentId,
                buildEvaluationJsonForUser(evaluationData.getEvaluationResult()));
    }

    private void finalizeEvaluationResults(String taskId, EvaluationResultFromDeepSeek results) throws Exception {
        objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(results);
        log.info("Finalizing taskId={}, results size={}", taskId, results.getEvaluationData().size());
        updateTask(taskId, json, TaskStatusEnum.COMPLETED.name());
    }

    private void handleEvaluationFailure(String taskId, Exception e) {
        updateTask(taskId, "Error occurred: " + e.getMessage(), TaskStatusEnum.FAILED.name());
    }

    private EvaluationRequestResponse initializeResponse(String taskId, List<EvaluationUserDTO> users) {
        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(taskId);
        response.setStatus(TaskStatusEnum.PROCESSING.name());
        return response;
    }

    private List<EvaluationResultFromDeepSeek.EvaluationData> createEvaluationResultFromUsers(
            List<EvaluationUserDTO> users) {
        List<EvaluationResultFromDeepSeek.EvaluationData> evaluationDataList = new ArrayList<>();
        for (EvaluationUserDTO evaluationUserDTO : users) {
            EvaluationResultFromDeepSeek.EvaluationData evaluationData = new EvaluationResultFromDeepSeek.EvaluationData();
            evaluationData.setName(evaluationUserDTO.getFullName());
            evaluationData.setEmail(evaluationUserDTO.getEmail());
            evaluationData.setUserId(evaluationUserDTO.getId());
            evaluationData.setStatus(EvaluationStepsStatusEnum.WAITING.name());
            evaluationData.setResponseId(evaluationUserDTO.getResponseId());
            UserDTO userDTO = userService.createOrGetExistingUser(createUserDTO(evaluationData));
            evaluationData.setUserId(userDTO.getId());
            evaluationDataList.add(evaluationData);
        }
        return evaluationDataList;
    }

    public String parseObjectToString(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse object to string", e);
            throw new VacademyException("Failed to parse object to string");
        }
    }

    private UserDTO createUserDTO(EvaluationResultFromDeepSeek.EvaluationData evaluationData) {
        UserDTO dto = new UserDTO();
        dto.setUsername(generateUsername(evaluationData.getName()));
        dto.setPassword(generatePassword());
        dto.setFullName(evaluationData.getName());
        dto.setEmail(evaluationData.getEmail());
        dto.setId(evaluationData.getUserId());
        return dto;
    }

    private String buildEvaluationJsonForUser(EvaluationResultFromDeepSeek.EvaluationResult evaluationResult) {
        try {
            objectMapper.setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(evaluationResult);
        } catch (Exception e) {
            log.error("Error while converting evaluation result to JSON", e);
            return null;
        }
    }

    private String getEvaluationFromAI(String prompt) {
        DeepSeekResponse response = deepSeekApiService.getChatCompletion(
                "google/gemini-2.5-flash-preview-09-2025",
                prompt,
                30000,
                "evaluation", // Request type for token usage logging
                null, // No institute ID available
                null // No user ID available
        );
        return response.getChoices().get(0).getMessage().getContent();
    }

    private String convertFileToHtml(String pdfId) {
        var fileStatus = fileConversionStatusService.findByVendorFileId(pdfId);
        String html = newDocConverterService.getConvertedHtml(pdfId);
        if (html == null)
            throw new VacademyException("File Still Processing");
        return extractBody(html);
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
        if (namePart.length() < 4)
            namePart = String.format("%-4s", namePart).replace(' ', 'X');
        return namePart + RandomStringUtils.randomNumeric(4);
    }

    private String generatePassword() {
        return RandomStringUtils.randomAlphanumeric(8);
    }

    public String cleanJsonMarkdown(String raw) {
        return raw.replaceAll("(?i)^```json\\s*", "").replaceAll("```$", "").trim();
    }

    private List<EvaluationResultFromDeepSeek.SectionWiseAnsExtracted> extractSectionWiseAns(
            List<AiEvaluationSectionDTO> sections, String htmlAnswerSheet) {
        String prompt = extractAnsForEachQuestionPromptForDeepSeek(sections, htmlAnswerSheet);

        for (int attempt = 1; attempt <= 5; attempt++) {
            try {
                System.out.println(attempt);
                String extractedJson = getEvaluationFromAI(prompt);
                extractedJson = cleanJsonMarkdown(extractedJson);
                System.out.println(extractedJson);
                List<EvaluationResultFromDeepSeek.SectionWiseAnsExtracted> result = objectMapper
                        .readValue(extractedJson, new TypeReference<>() {
                        });
                return result;
            } catch (Exception e) {
                log.warn("Attempt {} failed to parse DeepSeek answer extraction: {}", attempt, e.getMessage());
                if (attempt == 5) {
                    log.error("All attempts to parse DeepSeek response failed", e);
                    throw new VacademyException("Failed to parse section-wise extracted answers after 5 attempts");
                }
            }
        }
        return Collections.emptyList();
    }

    private EvaluationResultFromDeepSeek.EvaluationResult evaluateAnswers(
            List<EvaluationResultFromDeepSeek.SectionWiseAnsExtracted> sectionWiseAnsExtractedss,
            AiEvaluationMetadata metadata) {
        String prompt = generatePromptToEvaluateAnswer(sectionWiseAnsExtractedss, metadata);

        for (int attempt = 1; attempt <= 5; attempt++) {
            try {
                String evaluationJson = getEvaluationFromAI(prompt);
                evaluationJson = cleanJsonMarkdown(evaluationJson);
                log.debug("Parsed answer: {}",
                        objectMapper.writeValueAsString(objectMapper.readValue(evaluationJson, new TypeReference<>() {
                        })));
                return objectMapper.readValue(evaluationJson, new TypeReference<>() {
                });
            } catch (Exception e) {
                log.error("Attempt {}: Failed to parse evaluation result from DeepSeek", attempt, e);
                if (attempt == 5) {
                    throw new RuntimeException("Failed to parse evaluation result after 5 attempts", e);
                }
            }
        }

        throw new RuntimeException("Unexpected error during evaluation parsing");
    }

    public String extractAnsForEachQuestionPromptForDeepSeek(List<AiEvaluationSectionDTO> sections,
            String htmlAnswerSheet) {
        StringBuilder prompt = new StringBuilder();

        prompt.append(
                """
                        You are an AI assistant tasked with extracting answers from a student's HTML answer sheet.

                        DO NOT evaluate the answers or assign any marks.
                        Your ONLY task is to map each question (provided in the assessment metadata) to the answer written by the student.
                        If the student has not written an answer for a question, mark it as "NOT_ATTEMPTED".

                        Instructions:
                        - Every question from the metadata must be included in the output.
                        - Group the results section-wise.
                        - Sort questions by their 'question_order'.
                        - For each question, return:
                          - question_id
                          - question_order
                          - question_text (wrap inside [[ ]] to preserve formatting and HTML safely)
                          - question_wise_ans_extracted: {
                              answer_html (wrap inside [[ ]] to preserve formatting and HTML safely),
                              status ("ATTEMPTED" or "NOT_ATTEMPTED")
                            }

                        Important:
                        - ONLY return the extracted result as a valid JSON in the exact structure below.
                        - Do NOT include any explanation, extra text, or formatting outside of the JSON.
                        - Use double quotes for all JSON keys and string values.
                        - Ensure all special characters in HTML (like quotes) are escaped properly.
                        - Wrap HTML content and question text in double square brackets [[ ... ]] to prevent breaking the JSON format.

                        Additional Instructions for Answer Formatting:
                         - **Correct any spelling errors** in the student's answers based on the context of the question. Ensure that the corrected text makes sense within the context of the question being answered.
                         - **Format the answers properly**. If the student has written points or lists, ensure they are formatted using HTML bullet points (<ul>, <li>) or numbered lists (<ol>, <li>). Ensure paragraphs are wrapped in <p> tags where appropriate.
                         - **Maintain the original intent and meaning** of the answer while making it more readable and structured. For example, if the student has provided an unordered list of points in a plain text form, convert it into a proper HTML list.

                        JSON Response Format:
                        [
                          {
                            "section_id": "<section_id>",
                            "section_name": "<section_name>",
                            "question_wise_ans_extracted": [
                              {
                                "question_id": "<question_id>",
                                "question_order": <order>,
                                "question_text": "<text>",
                                "answer_html": "<html>",
                                "status": "ATTEMPTED" or "NOT_ATTEMPTED"
                              }
                            ]
                          }
                        ]

                        Below is the assessment metadata (questions grouped by sections):
                        """);

        for (AiEvaluationSectionDTO section : sections) {
            prompt.append("Section Name: ").append(section.getName()).append("\n");
            prompt.append("Section ID: ").append(section.getId()).append("\n");
            for (AiEvaluationQuestionDTO question : section.getQuestions()) {
                prompt.append("- Question Order: ").append(question.getQuestionOrder()).append("\n");
                prompt.append("  Question ID: ").append(question.getReachText().getId()).append("\n");
                prompt.append("  Question Text: [[")
                        .append(question.getReachText().getContent().replace("\"", "\\\""))
                        .append("]]\n");
            }
            prompt.append("\n");
        }

        // (Optional) Strip problematic MathJax tags if needed
        htmlAnswerSheet = htmlAnswerSheet.replaceAll("<mjx-[^>]*>.*?</mjx-[^>]*>", "");

        prompt.append("Below is the HTML answer sheet submitted by the student:\n\n")
                .append("[[")
                .append(htmlAnswerSheet.trim().replace("\"", "\\\""))
                .append("]]");

        return prompt.toString();
    }

    public String generatePromptToEvaluateAnswer(
            List<EvaluationResultFromDeepSeek.SectionWiseAnsExtracted> sectionWiseAnsExtracted,
            AiEvaluationMetadata metadata) {
        StringBuilder prompt = new StringBuilder();

        prompt.append(
                """
                        You are an AI assistant tasked with evaluating the student's answers using the provided metadata and answer sheet.

                        Instructions:
                        - For each question:
                          - If the student answered, evaluate the answer based on the evaluation criteria provided in the AI evaluation question metadata. Each criterion has a name and a weight, which determines the marks for the answer.
                          - For each criterion:
                            - Assign marks based on the student's response.
                            - The weight of the criterion determines how much the answer contributes to the total marks.
                          - If the student skipped, mark as "NOT_ATTEMPTED" and assign 0 marks.
                          - ⚠️ If no evaluation criteria (marking JSON) is provided for a question (i.e., the criteria list is empty or null):
                            - In the feedback, clearly mention: "No evaluation criteria provided."
                            - Assign 0 marks for such questions by default.

                        - For each question, provide:
                          - Marks obtained
                          - Total marks (based on all available criteria)
                          - Feedback (short and clear)
                          - Description (brief reasoning on why marks were awarded or deducted based on the evaluation criteria)
                          - Verdict (e.g., "Correct", "Partially Correct", "Incorrect", "Not Attempted")

                        ⚠️ Important:
                        - ONLY return a valid **JSON** response in the exact format described below.
                        - Do NOT include any explanation, summary, or formatting outside the JSON.
                        - Use double quotes for all JSON keys and string values.
                        - Escape any special characters properly if needed.

                        JSON Response Format:
                        {
                          "total_marks_obtained": <double>,
                          "total_marks": <double>,
                          "overall_verdict": "<verdict>",
                          "overall_description": "<short summary>",
                          "section_wise_results": [
                            {
                              "section_id": "<section_id>",
                              "section_name": "<section_name>",
                              "marks_obtained": <double>,
                              "total_marks": <double>,
                              "verdict": "<section_verdict>",
                              "question_wise_results": [
                                {
                                  "question_id": "<question_id>",
                                  "question_order": <int>,
                                  "question_text": "<text>",
                                  "marks_obtained": <double>,
                                  "total_marks": <double>,
                                  "feedback": "<short comment>",
                                  "description": "<detailed reasoning based on evaluation criteria>",
                                  "verdict": "<Correct/Incorrect/Partially Correct/Not Attempted>"
                                }
                              ]
                            }
                          ]
                        }

                        Below is the metadata and student answers for evaluation:
                        """);

        try {
            prompt.append("\nMetadata:\n").append(objectMapper.writeValueAsString(metadata));
            prompt.append("\n\nStudent Answers:\n").append(objectMapper.writeValueAsString(sectionWiseAnsExtracted));
        } catch (Exception e) {
            e.printStackTrace();
        }

        return prompt.toString();
    }

}