package vacademy.io.media_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.media_service.ai.DeepSeekLectureService;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.TextDTO;
import vacademy.io.media_service.dto.audio.AudioConversionDeepLevelResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class DeepSeekAsyncTaskService {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    ExternalAIApiService deepSeekService;

    @Autowired
    DeepSeekLectureService deepSeekLectureService;

    @Autowired
    FileConversionStatusService fileConversionStatusService;

    @Autowired
    NewDocConverterService newDocConverterService;

    @Autowired
    HtmlImageConverter htmlImageConverter;

    @Autowired
    NewAudioConverterService newAudioConverterService;

    int PDF_MAX_TRIES = 20;
    int PDF_DELAY = 20000;

    int AUDIO_MAX_TRIES = 50;
    int AUDIO_DELAY = 20000;

    public static String extractBody(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        // Regex to match the content between <body> and </body> tags
        Pattern pattern = Pattern.compile(
                "<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL // Handle case and multi-line content
        );

        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            // Extract the content (group 1) between the tags
            return matcher.group(1).trim(); // Trim to remove leading/trailing whitespace
        } else {
            return html;
        }
    }

    public void processDeepSeekTaskInBackground(TaskStatus taskStatus, String userPrompt, String networkHtml) {
        try {
            String restoreJson = (taskStatus.getResultJson() == null) ? "" : taskStatus.getResultJson();
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), null, "Questions Generating");

            String rawOutput = deepSeekService.getQuestionsWithDeepSeekFromHTMLRecursive(
                    networkHtml, userPrompt, restoreJson, 0, taskStatus
            );
            if(rawOutput==null || rawOutput.isEmpty()) taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), rawOutput, "No Response Generate");
            else taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
        } catch (Exception e) {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            log.error("Failed To Generate: " + e.getMessage());
        }
    }

    private void processDeepSeekTaskInBackgroundForPdftoQuestionOfTopic(TaskStatus taskStatus, String topics, String networkHtml) {
        try {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), null, "Questions Generating");

            String restoreJson = (taskStatus.getResultJson() == null) ? "" : taskStatus.getResultJson();

            String rawOutput = deepSeekService.getQuestionsWithDeepSeekFromHTMLOfTopics(
                    networkHtml, topics, restoreJson, 0, taskStatus
            );

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
        } catch (Exception e) {
            log.error("Failed To Generate: " + e.getMessage());
        }
    }

    private void processDeepSeekTaskInBackgroundForAudioToQuestionOfTopic(TaskStatus taskStatus, String convertedText, String numQuestions, String prompt, String difficulty, String language) {
        try {
            String restoreJson = (taskStatus.getResultJson() == null) ? "" : taskStatus.getResultJson();

            String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromAudio(convertedText, difficulty, numQuestions, prompt, restoreJson, 0, taskStatus));

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated"            );
        } catch (Exception e) {
            log.error("Failed To Generate: " + e.getMessage());
        }
    }

    @Async
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForLecturePlanner(TaskStatus taskStatus, String userPrompt, String lectureDuration, String language, String methodOfTeaching, String level) {
        return CompletableFuture.runAsync(() -> processDeepSeekTaskInBackgroundForLecturePlanner(taskStatus, userPrompt, lectureDuration, language, methodOfTeaching, level));
    }

    private void processDeepSeekTaskInBackgroundForLecturePlanner(TaskStatus taskStatus, String userPrompt, String lectureDuration, String language, String methodOfTeaching, String level) {
        try {
            String rawOutput = (deepSeekLectureService.generateLecturePlannerFromPrompt(userPrompt, lectureDuration, language, methodOfTeaching, taskStatus, level, 0));

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
        } catch (Exception e) {
            log.error("Failed To Generate: " + e.getMessage());
        }
    }

    private void processDeepSeekTaskInBackgroundForLectureFeedback(TaskStatus taskStatus, String text, AudioConversionDeepLevelResponse convertedAudioResponse) {
        try {
            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), null, "Questions Generating");

            String convertedAudioResponseString = getStringFromObject(convertedAudioResponse);
            String audioPace = getPaceFromTextAndDuration(text, convertedAudioResponse.getAudioDuration());

            String rawOutput = (deepSeekLectureService.generateLectureFeedback(text, convertedAudioResponseString, taskStatus, 0, audioPace));

            taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
        } catch (Exception e) {
            log.error("Failed To Generate: " + e.getMessage());
        }
    }

    private String getPaceFromTextAndDuration(String text, Long audioDuration) {
        if (Objects.isNull(text) || Objects.isNull(audioDuration) || audioDuration == 0) return "0";

        int wordCount = text.trim().isEmpty() ? 0 : text.trim().split("\\s+").length;
        float audioDurationInMinutes = (float) audioDuration / 60f;
        double pace = (double) wordCount / audioDurationInMinutes;

        return String.format("%.2f", pace); // return pace with 2 decimal points
    }

    private String getStringFromObject(AudioConversionDeepLevelResponse convertedAudioResponse) throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.writeValueAsString(convertedAudioResponse);
    }

    private void processDeepSeekTaskInBackgroundForTextToQuestions(TextDTO textPrompt, TaskStatus taskStatus) {
        String oldJson = taskStatus.getResultJson() != null ? taskStatus.getResultJson() : "";
        taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), null, "Questions Generating");
        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromTextPrompt(textPrompt.getText(), textPrompt.getNum().toString(), textPrompt.getQuestionType(), textPrompt.getClassLevel(), textPrompt.getTopics(), textPrompt.getQuestionLanguage(), taskStatus, 0, oldJson));
        if(rawOutput==null || rawOutput.isEmpty()) taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput,"No Response Generated");
        else taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
    }

    private void processDeepSeekTaskInBackgroundSortPdfQuestionsWithTopics(String networkHtml, TaskStatus taskStatus) {
        taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.PROGRESS.name(), null, "Questions Generating");

        String rawOutput = (deepSeekService.getQuestionsWithDeepSeekFromHTMLWithTopics(networkHtml, taskStatus, 0, ""));
        if(rawOutput==null || rawOutput.isEmpty()) taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), rawOutput, "No Response Generated");
        else taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.COMPLETED.name(), rawOutput, "Questions Generated");
    }

    public CompletableFuture<Void> pollAndProcessPdfToQuestions(TaskStatus taskStatus, String pdfId, String userPrompt) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Update task status as FILE_PROCESSING during polling
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING.name(), null, "Questions Generating");

                for (int attempt = 1; attempt <= PDF_MAX_TRIES; attempt++) {

                    var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

                    if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
                        processDeepSeekTaskInBackground(taskStatus, userPrompt, fileConversionStatus.get().getHtmlText());
                        return;
                    }

                    // Try converting if not available
                    String html = newDocConverterService.getConvertedHtml(pdfId);
                    if (html != null) {
                        String htmlBody = extractBody(html);
                        String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
                        fileConversionStatusService.updateHtmlText(pdfId, networkHtml);


                        processDeepSeekTaskInBackground(taskStatus, userPrompt, networkHtml);
                        return;
                    }

                    Thread.sleep(PDF_DELAY); // wait before next attempt
                }

                // After retries exhausted
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, "Failed To Process PDF");

            } catch (Exception e) {
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            }
        });
    }

    @Async
    public CompletableFuture<Void> pollAndProcessSortQuestionTopicWise(TaskStatus taskStatus, String pdfId) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Update task status as FILE_PROCESSING during polling
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING.name(), null, "Questions Generating");

                for (int attempt = 1; attempt <= PDF_MAX_TRIES; attempt++) {

                    var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

                    if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {

                        processDeepSeekTaskInBackgroundSortPdfQuestionsWithTopics(fileConversionStatus.get().getHtmlText(), taskStatus);
                        return;
                    }

                    // Try converting if not available
                    String html = newDocConverterService.getConvertedHtml(pdfId);
                    if (html != null) {
                        String htmlBody = extractBody(html);
                        String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
                        fileConversionStatusService.updateHtmlText(pdfId, networkHtml);

                        processDeepSeekTaskInBackgroundSortPdfQuestionsWithTopics(networkHtml, taskStatus);
                        return;
                    }

                    Thread.sleep(PDF_DELAY); // wait before next attempt
                }

                // After retries exhausted
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, "Failed To Process PDF");

            } catch (Exception e) {
                log.error("Exception during polling: {}", e.getMessage(), e);
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            }
        });
    }

    @Async
    public CompletableFuture<Void> pollAndProcessPdfExtractTopicQuestions(TaskStatus taskStatus, String pdfId, String requiredTopics) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Update task status as FILE_PROCESSING during polling
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING.name(), null, "Questions Generating");

                for (int attempt = 1; attempt <= PDF_MAX_TRIES; attempt++) {

                    var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);

                    if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {

                        processDeepSeekTaskInBackgroundForPdftoQuestionOfTopic(taskStatus, requiredTopics, fileConversionStatus.get().getHtmlText());
                        return;
                    }

                    // Try converting if not available
                    String html = newDocConverterService.getConvertedHtml(pdfId);
                    if (html != null) {
                        String htmlBody = extractBody(html);
                        String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
                        fileConversionStatusService.updateHtmlText(pdfId, networkHtml);

                        processDeepSeekTaskInBackgroundForPdftoQuestionOfTopic(taskStatus, requiredTopics, networkHtml);
                        return;
                    }

                    Thread.sleep(PDF_DELAY); // wait before next attempt
                }

                // After retries exhausted
                log.error("Failed to get HTML after retries, marking task as FAILED");
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, "Failed To Process PDF");

            } catch (Exception e) {
                log.error("Exception during polling: {}", e.getMessage(), e);
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            }
        });
    }

    @Async
    public CompletableFuture<Void> pollAndProcessAudioToQuestions(TaskStatus taskStatus, String audioId, String prompt, String difficulty, String language, String numQuestions) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Update task status as FILE_PROCESSING during polling
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING.name(), null, "Questions Generating");

                for (int attempt = 1; attempt <= AUDIO_MAX_TRIES; attempt++) {
                    log.info("Polling attempt {} for pdfId {}", attempt, audioId);

                    var fileConversionStatus = fileConversionStatusService.findByVendorFileId(audioId);

                    if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
                        log.info("HTML found, proceeding with deep seek task");
                        processDeepSeekTaskInBackgroundForAudioToQuestionOfTopic(taskStatus, fileConversionStatus.get().getHtmlText(), numQuestions, prompt, difficulty, language);
                        return;
                    }

                    // Try converting if not available
                    String convertedText = newAudioConverterService.getConvertedAudio(audioId);
                    if (convertedText != null) {
                        fileConversionStatusService.updateHtmlText(audioId, convertedText);

                        log.info("HTML successfully converted, proceeding with deep seek task");
                        processDeepSeekTaskInBackgroundForAudioToQuestionOfTopic(taskStatus, convertedText, numQuestions, prompt, difficulty, language);
                        return;
                    }

                    Thread.sleep(AUDIO_DELAY); // wait before next attempt
                }

                // After retries exhausted
                log.error("Failed to get HTML after retries, marking task as FAILED");
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, "Failed To Process Audio");

            } catch (Exception e) {
                log.error("Exception during polling: {}", e.getMessage(), e);
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            }
        });
    }

    public String generateUniqueId(String input) {
        try {
            String timestamp = new SimpleDateFormat("yyyyMMddHHmmssSSS").format(new Date());
            String combined = input + "-" + timestamp;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(combined.getBytes(StandardCharsets.UTF_8));
            String base64Encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);

            // Return first 20 characters for uniqueness + brevity
            return base64Encoded.substring(0, 20);
        } catch (Exception e) {
            throw new RuntimeException("Error generating unique ID", e);
        }
    }

    @Async
    public CompletableFuture<Void> pollAndProcessAudioFeedback(TaskStatus taskStatus, String audioId) {
        return CompletableFuture.runAsync(() -> {
            try {
                // Update task status as FILE_PROCESSING during polling
                taskStatusService.updateTaskStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING.name(), null, "Questions Generating");

                for (int attempt = 1; attempt <= AUDIO_MAX_TRIES; attempt++) {

                    AudioConversionDeepLevelResponse convertedAudioResponse = newAudioConverterService.getConvertedAudioResponse(audioId);

                    if (convertedAudioResponse != null && convertedAudioResponse.getText() != null) {
                        fileConversionStatusService.updateHtmlText(audioId, convertedAudioResponse.getText());
                        processDeepSeekTaskInBackgroundForLectureFeedback(taskStatus, convertedAudioResponse.getText(), convertedAudioResponse);
                        return;
                    }
                    Thread.sleep(AUDIO_DELAY); // wait before next attempt
                }

                // After retries exhausted
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, "Failed To Process Audio");

            } catch (Exception e) {
                taskStatusService.updateTaskStatusAndStatusMessage(taskStatus, TaskStatusEnum.FAILED.name(), null, e.getMessage());
            }
        });
    }

    @Async
    public CompletableFuture<Void> pollAndProcessTextToQuestions(TaskStatus taskStatus, TextDTO textPrompt) {
        return CompletableFuture.runAsync(() -> processDeepSeekTaskInBackgroundForTextToQuestions(textPrompt, taskStatus));
    }
}
