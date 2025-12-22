package vacademy.io.media_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.ai.DeepSeekLectureService;
import vacademy.io.media_service.ai.ExternalAIApiService;
import vacademy.io.media_service.dto.TextDTO;
import vacademy.io.media_service.dto.audio.AudioConversionDeepLevelResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.exception.FileConversionException;
import vacademy.io.media_service.util.IdGenerationUtils;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Service for handling async AI processing tasks.
 * Refactored to use PollingService with ScheduledExecutorService instead of
 * Thread.sleep.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeepSeekAsyncTaskService {

    private final TaskStatusService taskStatusService;
    private final ExternalAIApiService externalAIApiService;
    private final DeepSeekLectureService deepSeekLectureService;
    private final PollingService pollingService;

    // Timeout for polling operations (max wait time)
    private static final long POLLING_TIMEOUT_MINUTES = 15;

    // ==================== PDF Processing ====================

    /**
     * Polls for PDF conversion completion and processes to questions.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessPdfToQuestions(
            TaskStatus taskStatus,
            String pdfId,
            String userPrompt) {

        return pollAndProcessPdfToQuestions(taskStatus, pdfId, userPrompt, null);
    }

    /**
     * Polls for PDF conversion completion and processes to questions with model
     * override.
     * Uses PollingService with ScheduledExecutorService instead of Thread.sleep.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessPdfToQuestions(
            TaskStatus taskStatus,
            String pdfId,
            String userPrompt,
            String preferredModel) {

        updateStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING, "Starting PDF processing...");

        return pollingService.pollForPdfHtmlAsync(pdfId, taskStatus)
                .orTimeout(POLLING_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                .thenCompose(networkHtml -> {
                    if (networkHtml != null) {
                        return processDeepSeekTaskAsync(taskStatus, userPrompt, networkHtml, preferredModel);
                    } else {
                        return CompletableFuture.failedFuture(
                                FileConversionException.conversionFailed(pdfId, "Timeout waiting for PDF conversion"));
                    }
                })
                .exceptionally(ex -> {
                    log.error("PDF to questions processing failed for task {}: {}", taskStatus.getId(), ex.getMessage(),
                            ex);
                    updateStatusFailed(taskStatus, "PDF processing failed: " + getRootCauseMessage(ex));
                    return null;
                });
    }

    /**
     * Polls for PDF conversion and sorts questions topic-wise.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessSortQuestionTopicWise(TaskStatus taskStatus, String pdfId) {
        updateStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING, "Processing PDF for topic sorting...");

        return pollingService.pollForPdfHtmlAsync(pdfId, taskStatus)
                .orTimeout(POLLING_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                .thenCompose(networkHtml -> {
                    if (networkHtml != null) {
                        return processSortQuestionsByTopicAsync(networkHtml, taskStatus, null);
                    } else {
                        return CompletableFuture.failedFuture(
                                FileConversionException.conversionFailed(pdfId, "Timeout waiting for PDF conversion"));
                    }
                })
                .exceptionally(ex -> {
                    log.error("Sort questions topic-wise failed for task {}: {}", taskStatus.getId(), ex.getMessage(),
                            ex);
                    updateStatusFailed(taskStatus, "Topic sorting failed: " + getRootCauseMessage(ex));
                    return null;
                });
    }

    /**
     * Polls for PDF conversion and extracts questions for specific topics.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessPdfExtractTopicQuestions(
            TaskStatus taskStatus,
            String pdfId,
            String requiredTopics) {

        updateStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING, "Extracting topic questions...");

        return pollingService.pollForPdfHtmlAsync(pdfId, taskStatus)
                .orTimeout(POLLING_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                .thenCompose(networkHtml -> {
                    if (networkHtml != null) {
                        return processTopicExtractionAsync(taskStatus, requiredTopics, networkHtml, null);
                    } else {
                        return CompletableFuture.failedFuture(
                                FileConversionException.conversionFailed(pdfId, "Timeout waiting for PDF conversion"));
                    }
                })
                .exceptionally(ex -> {
                    log.error("PDF topic extraction failed for task {}: {}", taskStatus.getId(), ex.getMessage(), ex);
                    updateStatusFailed(taskStatus, "Topic extraction failed: " + getRootCauseMessage(ex));
                    return null;
                });
    }

    // ==================== Audio Processing ====================

    /**
     * Polls for audio transcription and generates questions.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessAudioToQuestions(
            TaskStatus taskStatus,
            String audioId,
            String prompt,
            String difficulty,
            String language,
            String numQuestions) {

        return pollAndProcessAudioToQuestions(taskStatus, audioId, prompt, difficulty, language, numQuestions, null);
    }

    /**
     * Polls for audio transcription and generates questions with model override.
     * Uses PollingService with ScheduledExecutorService instead of Thread.sleep.
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessAudioToQuestions(
            TaskStatus taskStatus,
            String audioId,
            String prompt,
            String difficulty,
            String language,
            String numQuestions,
            String preferredModel) {

        updateStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING, "Processing audio transcription...");

        return pollingService.pollForAudioTranscriptionAsync(audioId, taskStatus)
                .orTimeout(POLLING_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                .thenCompose(transcribedText -> {
                    if (transcribedText != null) {
                        return processAudioToQuestionsAsync(taskStatus, transcribedText, numQuestions, prompt,
                                difficulty, language, preferredModel);
                    } else {
                        return CompletableFuture.failedFuture(
                                FileConversionException.conversionFailed(audioId,
                                        "Timeout waiting for audio transcription"));
                    }
                })
                .exceptionally(ex -> {
                    log.error("Audio to questions processing failed for task {}: {}", taskStatus.getId(),
                            ex.getMessage(), ex);
                    updateStatusFailed(taskStatus, "Audio processing failed: " + getRootCauseMessage(ex));
                    return null;
                });
    }

    /**
     * Polls for audio transcription and generates lecture feedback.
     * 
     * @param taskStatus The task status entity
     * @param audioId    The audio file ID
     * @param model      The AI model to use
     */
    @Async("fileProcessingExecutor")
    public CompletableFuture<Void> pollAndProcessAudioFeedback(TaskStatus taskStatus, String audioId, String model) {
        updateStatus(taskStatus, TaskStatusEnum.FILE_PROCESSING, "Analyzing lecture audio...");

        return pollingService.pollForAudioResponseAsync(audioId, taskStatus)
                .orTimeout(POLLING_TIMEOUT_MINUTES, TimeUnit.MINUTES)
                .thenCompose(audioResponse -> {
                    if (audioResponse != null && audioResponse.getText() != null) {
                        return processLectureFeedbackAsync(taskStatus, audioResponse, model);
                    } else {
                        return CompletableFuture.failedFuture(
                                FileConversionException.conversionFailed(audioId,
                                        "Timeout waiting for audio transcription"));
                    }
                })
                .exceptionally(ex -> {
                    log.error("Audio feedback processing failed for task {}: {}", taskStatus.getId(), ex.getMessage(),
                            ex);
                    updateStatusFailed(taskStatus, "Feedback processing failed: " + getRootCauseMessage(ex));
                    return null;
                });
    }

    // ==================== Text Processing ====================

    /**
     * Processes text to generate questions.
     */
    @Async("aiTaskExecutor")
    public CompletableFuture<Void> pollAndProcessTextToQuestions(TaskStatus taskStatus, TextDTO textPrompt) {
        return CompletableFuture.runAsync(() -> {
            try {
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Generating questions from text...");
                processTextToQuestions(textPrompt, taskStatus);
            } catch (Exception e) {
                log.error("Text to questions processing failed for task {}: {}", taskStatus.getId(), e.getMessage(), e);
                updateStatusFailed(taskStatus, "Text processing failed: " + e.getMessage());
            }
        });
    }

    /**
     * Processes lecture planner generation.
     * 
     * @param taskStatus       The task status entity
     * @param userPrompt       User's prompt for the lecture
     * @param lectureDuration  Duration of the lecture
     * @param language         Language for the content
     * @param methodOfTeaching Teaching method
     * @param level            Class/skill level
     * @param model            AI model to use
     */
    @Async("aiTaskExecutor")
    public CompletableFuture<Void> processDeepSeekTaskInBackgroundWrapperForLecturePlanner(
            TaskStatus taskStatus,
            String userPrompt,
            String lectureDuration,
            String language,
            String methodOfTeaching,
            String level,
            String model) {

        return CompletableFuture.runAsync(() -> {
            try {
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Generating lecture plan...");

                String rawOutput = deepSeekLectureService.generateLecturePlannerFromPrompt(
                        userPrompt, lectureDuration, language, methodOfTeaching, taskStatus, level, 0);

                updateStatusCompleted(taskStatus, rawOutput, "Lecture plan generated successfully");
            } catch (Exception e) {
                log.error("Lecture planner failed for task {}: {}", taskStatus.getId(), e.getMessage(), e);
                updateStatusFailed(taskStatus, "Lecture plan generation failed: " + e.getMessage());
            }
        });
    }

    // ==================== Async Processing Methods ====================

    private CompletableFuture<Void> processDeepSeekTaskAsync(
            TaskStatus taskStatus, String userPrompt, String networkHtml, String preferredModel) {

        return CompletableFuture.runAsync(() -> {
            try {
                String restoreJson = taskStatus.getResultJson() != null ? taskStatus.getResultJson() : "";
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Generating questions...");

                String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTMLRecursive(
                        networkHtml, userPrompt, restoreJson, 0, taskStatus);

                updateStatusCompleted(taskStatus, rawOutput, "Question generation completed");
            } catch (Exception e) {
                throw new RuntimeException("Question generation failed: " + e.getMessage(), e);
            }
        });
    }

    private CompletableFuture<Void> processSortQuestionsByTopicAsync(
            String networkHtml, TaskStatus taskStatus, String preferredModel) {

        return CompletableFuture.runAsync(() -> {
            try {
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Sorting questions by topic...");

                String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTMLWithTopics(
                        networkHtml, taskStatus, 0, "");

                updateStatusCompleted(taskStatus, rawOutput, "Topic sorting completed");
            } catch (Exception e) {
                throw new RuntimeException("Topic sorting failed: " + e.getMessage(), e);
            }
        });
    }

    private CompletableFuture<Void> processTopicExtractionAsync(
            TaskStatus taskStatus, String requiredTopics, String networkHtml, String preferredModel) {

        return CompletableFuture.runAsync(() -> {
            try {
                String restoreJson = taskStatus.getResultJson() != null ? taskStatus.getResultJson() : "";
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Extracting topic questions...");

                String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromHTMLOfTopics(
                        networkHtml, requiredTopics, restoreJson, 0, taskStatus);

                updateStatusCompleted(taskStatus, rawOutput, "Topic extraction completed");
            } catch (Exception e) {
                throw new RuntimeException("Topic extraction failed: " + e.getMessage(), e);
            }
        });
    }

    private CompletableFuture<Void> processAudioToQuestionsAsync(
            TaskStatus taskStatus, String transcribedText, String numQuestions, String prompt,
            String difficulty, String language, String preferredModel) {

        return CompletableFuture.runAsync(() -> {
            try {
                String restoreJson = taskStatus.getResultJson() != null ? taskStatus.getResultJson() : "";
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Generating questions from audio...");

                // getQuestionsWithDeepSeekFromAudio signature: (audioString, difficulty,
                // numQuestions, optionalPrompt, oldResponse, attempt, taskStatus)
                String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromAudio(
                        transcribedText, difficulty, numQuestions, prompt, restoreJson, 0, taskStatus);

                updateStatusCompleted(taskStatus, rawOutput, "Audio question generation completed");
            } catch (Exception e) {
                throw new RuntimeException("Audio question generation failed: " + e.getMessage(), e);
            }
        });
    }

    private CompletableFuture<Void> processLectureFeedbackAsync(
            TaskStatus taskStatus, AudioConversionDeepLevelResponse audioResponse, String model) {

        return CompletableFuture.runAsync(() -> {
            try {
                updateStatus(taskStatus, TaskStatusEnum.PROGRESS, "Generating lecture feedback...");

                // generateLectureFeedback signature: (text, convertedAudioResponseString,
                // taskStatus, attempt, audioPace)
                String audioPace = audioResponse.getAudioDuration() != null
                        ? String.valueOf(audioResponse.getAudioDuration())
                        : "unknown";
                String rawOutput = deepSeekLectureService.generateLectureFeedback(
                        audioResponse.getText(), audioResponse.toString(), taskStatus, 0, audioPace);

                updateStatusCompleted(taskStatus, rawOutput, "Lecture feedback generated");
            } catch (Exception e) {
                throw new RuntimeException("Lecture feedback generation failed: " + e.getMessage(), e);
            }
        });
    }

    private void processTextToQuestions(TextDTO textPrompt, TaskStatus taskStatus) {
        try {
            String restoreJson = taskStatus.getResultJson() != null ? taskStatus.getResultJson() : "";

            // getQuestionsWithDeepSeekFromTextPrompt signature: (textPrompt,
            // numberOfQuestions, typeOfQuestion, classLevel, topics, language, taskStatus,
            // attempt, oldJson)
            String rawOutput = externalAIApiService.getQuestionsWithDeepSeekFromTextPrompt(
                    textPrompt.getText(),
                    String.valueOf(textPrompt.getNum()),
                    textPrompt.getQuestionType(),
                    textPrompt.getClassLevel(),
                    textPrompt.getTopics(),
                    textPrompt.getQuestionLanguage(),
                    taskStatus,
                    0,
                    restoreJson);

            updateStatusCompleted(taskStatus, rawOutput, "Text question generation completed");
        } catch (Exception e) {
            throw new RuntimeException("Text question generation failed: " + e.getMessage(), e);
        }
    }

    // ==================== Utility Methods ====================

    private void updateStatus(TaskStatus taskStatus, TaskStatusEnum status, String message) {
        taskStatusService.updateTaskStatusAndStatusMessage(
                taskStatus,
                status.name(),
                taskStatus.getResultJson(),
                message);
    }

    private void updateStatusCompleted(TaskStatus taskStatus, String resultJson, String message) {
        taskStatusService.updateTaskStatusAndStatusMessage(
                taskStatus,
                TaskStatusEnum.COMPLETED.name(),
                resultJson,
                message);
    }

    private void updateStatusFailed(TaskStatus taskStatus, String message) {
        taskStatusService.updateTaskStatusAndStatusMessage(
                taskStatus,
                TaskStatusEnum.FAILED.name(),
                taskStatus.getResultJson(),
                message);
    }

    /**
     * Gets the root cause message from a throwable chain.
     */
    private String getRootCauseMessage(Throwable throwable) {
        Throwable cause = throwable;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause.getMessage() != null ? cause.getMessage() : throwable.getMessage();
    }

    /**
     * Generates a unique ID for a given input.
     */
    public String generateUniqueId(String input) {
        return IdGenerationUtils.generateUniqueId(input);
    }
}
