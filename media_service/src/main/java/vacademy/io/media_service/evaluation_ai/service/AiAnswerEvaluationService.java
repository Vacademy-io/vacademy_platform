package vacademy.io.media_service.evaluation_ai.service;

import lombok.RequiredArgsConstructor;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class AiAnswerEvaluationService {

    private final FileService fileService;
    private final FileConversionStatusService fileConversionStatusService;
    private final NewDocConverterService newDocConverterService;
    private final DeepSeekApiService deepSeekApiService;
    private final TaskStatusRepository taskStatusRepository;
    private final AssessmentService assessmentService;

    public EvaluationRequestResponse evaluateAnswers(
            String assessmentId,
            List<EvaluationUserDTO> evaluationUsers
    ) {
        AiEvaluationMetadata metadata = assessmentService.getAssessmentMetadata(assessmentId);
        // Generate a task ID for the group evaluation
        String taskId = createNewTask(UUID.randomUUID().toString());

        // Prepare and return immediate response
        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(taskId);
        response.setStatus(TaskStatusEnum.PROCESSING.name());
        response.setResponse(""); // Result will be fetched via another API

        // Background processing (non-blocking)
        new Thread(() -> {
            try {
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
                updateTask(taskId, result, TaskStatusEnum.COMPLETED.name());
            } catch (Exception e) {
                updateTask(taskId, e.getMessage(), TaskStatusEnum.FAILED.name());
            }
        }).start();

        return response;
    }


    private String generatePromptForMultipleUsers(AiEvaluationMetadata metadata, List<Map<String, Object>> userHtmlDataList) {
        StringBuilder promptBuilder = new StringBuilder();

        promptBuilder.append("""
        You are an AI examiner. Multiple students have submitted their full assessments in HTML format.
        Use the provided assessment metadata to evaluate each student's answers individually.

        For each question, provide:
        - `feedback`: A brief explanation of the correctness or issues in the answer (e.g., missing important points).
        - `description`: A brief reason for awarding or deducting marks (e.g., minor mistake, unclear answer, partial correctness).
        - `markingJson`: A breakdown of the marks distribution for each question. The total marks for the question should be distributed across different criteria (e.g., Diagram, Explanation, Example).
          Example format:
          "markingJson": {
            "totalMarks": 10,
            "criteria": [
              {"name": "Diagram", "marks": 4},
              {"name": "Explanation", "marks": 3},
              {"name": "Example", "marks": 3}
            ]
          }

        Respond strictly in JSON format matching this structure:

        {
          "evaluation_results": [
            {
              "user_id": "<string>",
              "name": "<string>",
              "email": "<string>",
              "contact_number": "<string>",
              "total_marks_obtained": <numeric>,
              "total_marks": <numeric>,
              "overall_verdict": "pass/fail/absent/etc.",
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
                      "verdict": "correct/partially correct/incorrect/null",
                      "markingJson": {
                        "totalMarks": <numeric>,
                        "criteria": [
                          {"name": "Diagram", "marks": <numeric>},
                          {"name": "Explanation", "marks": <numeric>},
                          {"name": "Example", "marks": <numeric>}
                        ]
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }

        Assessment Metadata:
        """);

        promptBuilder.append("\n").append(metadata.toString()).append("\n\n");

        for (Map<String, Object> userHtmlData : userHtmlDataList) {
            EvaluationUserDTO user = (EvaluationUserDTO) userHtmlData.get("user");
            String html = (String) userHtmlData.get("html");

            promptBuilder.append("Student Response:\n");
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
        return taskStatusRepository.save(taskStatus).getId();
    }

    public String updateTask(String taskId, String resultJson, String status) {
        TaskStatus task = taskStatusRepository.findById(taskId)
                .orElseThrow(() -> new VacademyException("Task not found"));
        task.setStatus(status);
        task.setResultJson(resultJson);
        return taskStatusRepository.save(task).getId();
    }

    private String generateFullHtmlPrompt(AiEvaluationMetadata metadata, String fullHtmlAnswer) {
        return """
        You are an AI examiner. You will receive the complete HTML answer script of a student along with assessment metadata. 
        Based on that, return the evaluation in the following exact JSON format:

        {
          "evaluationResults": [
            {
              "userId": "string",
              "name": "string",
              "email": "string",
              "contactNumber": "string",
              "totalMarksObtained": double,
              "totalMarks": double,
              "overallVerdict": "pass/fail/absent",
              "sectionWiseResults": [
                {
                  "sectionId": "string",
                  "sectionName": "string",
                  "marksObtained": double,
                  "totalMarks": double,
                  "verdict": "pass/fail",
                  "questionWiseResults": [
                    {
                      "questionId": "string",
                      "questionOrder": int,
                      "marksObtained": double,
                      "totalMarks": double,
                      "feedback": "string",
                      "verdict": "correct/partially correct/incorrect"
                    }
                  ]
                }
              ]
            }
          ]
        }

        Follow this structure strictly. Don't add extra fields.

        Assessment Metadata:
        %s

        Full HTML Answer Submission:
        %s
        """.formatted(metadata.toString(), fullHtmlAnswer);
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

    public EvaluationRequestResponse

    getTaskUpdate(String taskId) {
        TaskStatus task = taskStatusRepository.findById(taskId)
                .orElseThrow(() -> new VacademyException("Task not found"));

        EvaluationRequestResponse response = new EvaluationRequestResponse();
        response.setTaskId(task.getId());
        response.setStatus(task.getStatus());
        response.setResponse(task.getResultJson());

        return response;
    }

}