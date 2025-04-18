package vacademy.io.media_service.evaluation_ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.DeepSeekApiService;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.entity.TaskStatusEnum;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.enums.TaskTypeEnum;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationRequestResponse;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserDTO;
import vacademy.io.media_service.repository.TaskStatusRepository;
import vacademy.io.media_service.service.FileConversionStatusService;
import vacademy.io.media_service.service.FileService;
import vacademy.io.media_service.service.NewDocConverterService;

import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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

    private static final ExecutorService executorService = Executors.newFixedThreadPool(5);

    public EvaluationRequestResponse evaluateAnswers(
            String assessmentId,
            List<EvaluationUserDTO> evaluationUsers
    ) {
        AiEvaluationMetadata metadata = assessmentService.getAssessmentMetadata(assessmentId);
        String taskId = createNewTask(UUID.randomUUID().toString());

        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(taskId);
        response.setStatus(TaskStatusEnum.PROCESSING.name());
        response.setResponse("");

        executorService.submit(() -> {
            try {
                log.info("Started evaluation task: {}", taskId);
                List<Map<String, Object>> userHtmlDataList = new ArrayList<>();

                for (EvaluationUserDTO user : evaluationUsers) {
                    String html = convertFileToHtml(user.getResponseId());
                    userHtmlDataList.add(Map.of(
                            "user", user,
                            "html", html
                    ));
                }

                String prompt = generatePromptForMultipleUsers(metadata, userHtmlDataList);
                String result = evaluateWithRetry(prompt, 5);
                updateTaskIfNotCompleted(taskId, result, TaskStatusEnum.COMPLETED.name());
                log.info("Completed evaluation task: {}", taskId);
            } catch (Exception e) {
                log.error("Error during evaluation for task: {}", taskId, e);
                updateTaskIfNotCompleted(taskId, e.getMessage(), TaskStatusEnum.FAILED.name());
            }
        });

        return response;
    }

    private String generatePromptForMultipleUsers(AiEvaluationMetadata metadata, List<Map<String, Object>> userHtmlDataList) {
        StringBuilder promptBuilder = new StringBuilder();

        promptBuilder.append("""
        You are an AI Examiner evaluating full assessments submitted by multiple students. Each student’s response is in HTML format and should be evaluated **individually** using the provided assessment metadata.

        ---
          Evaluation Instructions:
        - Use the metadata (sections, questions, criteria, and marking scheme) to fairly evaluate each student's answers.
        - For each question, generate:
          • feedback: Highlight correctness or issues (e.g., incomplete explanation, missing diagram).
          • description: Justify marks awarded or deducted (e.g., "missed key concept", "example not relevant").
          • markingJson: A detailed breakdown of marks based on predefined criteria (Diagram, Explanation, Example, etc.).

        You must strictly respond in valid JSON following this structure:

        {
          "evaluation_results": [
            {
              "user_id": "<string>",                    // Unique ID of the student.
              "name": "<string>",                       // Full name of the student.
              "email": "<string>",                      // Email ID.
              "contact_number": "<string>",             // Contact number (if available).
              "total_marks_obtained": <number>,         // Total marks awarded to this student.
              "total_marks": <number>,                  // Total possible marks for the assessment.
              "overall_description": "<string>",        // Summary of performance (strengths, weaknesses, issues).
              "overall_verdict": "pass/fail/absent",    // Overall result based on total marks and performance.
              "section_wise_results": [
                {
                  "section_id": "<string>",             // Unique ID of the section.
                  "section_name": "<string>",           // Section title (e.g., "Maths", "Physics").
                  "marks_obtained": <number>,           // Marks obtained in this section.
                  "total_marks": <number>,              // Max marks in this section.
                  "verdict": "pass/fail/null",          // Verdict for this section.
                  "question_wise_results": [
                    {
                      "question_id": "<string>",        // Unique ID of the question.
                      "question_order": <number>,       // Order of the question in the section.
                      "marks_obtained": <number>,       // Marks given for this question.
                      "total_marks": <number>,          // Maximum marks for this question.
                      "feedback": "<string>",           // Short feedback about the answer.
                      "description": "<string>",        // Justification for the given marks.
                      "verdict": "correct/partially correct/incorrect/null", // Final judgment.
                      "question_text": "<string>",      // Original question text.
                      "marking_json": {
                        "total_marks": <number>,         // Max marks for this question.
                        "criteria": [
                          {"name": "Diagram", "marks": <number>},        // Optional
                          {"name": "Explanation", "marks": <number>},    // Optional
                          {"name": "Example", "marks": <number>}         // Optional
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }

        ---
        📄 Assessment Metadata:
        """);

        promptBuilder.append("\n").append(metadata.toString()).append("\n\n");

        for (Map<String, Object> userHtmlData : userHtmlDataList) {
            EvaluationUserDTO user = (EvaluationUserDTO) userHtmlData.get("user");
            String html = (String) userHtmlData.get("html");

            promptBuilder.append("---- Student Submission ----\n");
            promptBuilder.append("User ID: ").append(user.getId()).append("\n");
            promptBuilder.append("Name: ").append(user.getFullName()).append("\n");
            promptBuilder.append("Email: ").append(user.getEmail()).append("\n");
            promptBuilder.append("Contact Number: ").append(user.getContactNumber()).append("\n");
            promptBuilder.append("HTML Answer:\n").append(html).append("\n\n");
        }

        return promptBuilder.toString();
    }


    private String evaluateWithRetry(String prompt, int maxAttempts) {
        int attempt = 0;
        while (attempt < maxAttempts) {
            try {
                return getEvaluationFromAI(prompt);
            } catch (Exception e) {
                log.warn("Attempt {}/{} failed: {}", attempt + 1, maxAttempts, e.getMessage());
                attempt++;
                if (attempt == maxAttempts) throw e;
                try { Thread.sleep(1000); } catch (InterruptedException ignored) {}
            }
        }
        return "";
    }

    public String createNewTask(String inputId) {
        TaskStatus taskStatus = new TaskStatus();
        taskStatus.setType(TaskTypeEnum.EVALUATION.name());
        taskStatus.setStatus(TaskStatusEnum.PROCESSING.name());
        taskStatus.setInputId(inputId);
        taskStatus.setId(UUID.randomUUID().toString());
        taskStatus.setInputType("ASSESSMENT_EVALUATION");
        taskStatus.setResultJson("");
        TaskStatus saved = taskStatusRepository.save(taskStatus);
        log.info("Created new task with ID: {}", saved.getId());
        return saved.getId();
    }

    public void updateTaskIfNotCompleted(String taskId, String resultJson, String status) {
        TaskStatus task = taskStatusRepository.findById(taskId)
                .orElseThrow(() -> new VacademyException("Task not found"));

        if (!TaskStatusEnum.PROCESSING.name().equals(task.getStatus())) {
            log.warn("Skipping update. Task {} is already in status {}", taskId, task.getStatus());
            return;
        }

        task.setStatus(status);
        task.setResultJson(resultJson);
        taskStatusRepository.save(task);
        log.info("Updated task {} with status {}", taskId, status);
    }

    private String getEvaluationFromAI(String prompt) {
        DeepSeekResponse response = deepSeekApiService.getChatCompletion(
                "deepseek/deepseek-chat-v3-0324:free", prompt, 3000
        );
        return response.getChoices().get(0).getMessage().getContent();
    }

    private String convertFileToHtml(String pdfId) {
        var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);
        String html = newDocConverterService.getConvertedHtml(pdfId);
        if (html == null) {
            log.warn("HTML conversion not complete for file ID: {}", pdfId);
            throw new VacademyException("File Still Processing");
        }
        return extractBody(html);
    }

    public static String extractBody(String html) {
        if (!StringUtils.hasText(html)) return "";

        Pattern pattern = Pattern.compile(
                "<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL
        );
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? matcher.group(1).trim() : html;
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
}
