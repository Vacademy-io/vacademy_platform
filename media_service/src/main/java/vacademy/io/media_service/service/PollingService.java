package vacademy.io.media_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.media_service.config.AiModelConfig;
import vacademy.io.media_service.dto.audio.AudioConversionDeepLevelResponse;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.util.HtmlParsingUtils;

import jakarta.annotation.PreDestroy;
import java.util.concurrent.*;
import java.util.function.Supplier;

/**
 * Service for polling file conversion status using ScheduledExecutorService.
 * Replaces Thread.sleep pattern with proper scheduled polling.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PollingService {

    private final FileConversionStatusService fileConversionStatusService;
    private final NewDocConverterService newDocConverterService;
    private final NewAudioConverterService newAudioConverterService;
    private final HtmlImageConverter htmlImageConverter;
    private final TaskStatusService taskStatusService;
    private final AiModelConfig aiModelConfig;

    // Single-threaded scheduler for polling - avoids creating many threads
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(5, r -> {
        Thread t = new Thread(r, "Polling-Scheduler");
        t.setDaemon(true);
        return t;
    });

    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(30, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Polls for PDF conversion completion asynchronously.
     * Uses ScheduledExecutorService instead of Thread.sleep.
     *
     * @param pdfId      The PDF ID to poll for
     * @param taskStatus The task status to update
     * @return CompletableFuture that completes with the HTML content or null on
     *         timeout
     */
    public CompletableFuture<String> pollForPdfHtmlAsync(String pdfId, TaskStatus taskStatus) {
        int maxTries = aiModelConfig.getPdf().getMaxTries();
        int delayMs = aiModelConfig.getPdf().getDelayMs();

        return pollWithScheduler(
                () -> checkPdfConversion(pdfId),
                maxTries,
                delayMs,
                taskStatus,
                "Processing PDF");
    }

    /**
     * Polls for audio transcription completion asynchronously.
     *
     * @param audioId    The audio ID to poll for
     * @param taskStatus The task status to update
     * @return CompletableFuture that completes with the transcription or null on
     *         timeout
     */
    public CompletableFuture<String> pollForAudioTranscriptionAsync(String audioId, TaskStatus taskStatus) {
        int maxTries = aiModelConfig.getAudio().getMaxTries();
        int delayMs = aiModelConfig.getAudio().getDelayMs();

        return pollWithScheduler(
                () -> checkAudioConversion(audioId),
                maxTries,
                delayMs,
                taskStatus,
                "Transcribing audio");
    }

    /**
     * Polls for audio response with detailed information.
     *
     * @param audioId    The audio ID to poll for
     * @param taskStatus The task status to update
     * @return CompletableFuture with the audio response or null on timeout
     */
    public CompletableFuture<AudioConversionDeepLevelResponse> pollForAudioResponseAsync(
            String audioId, TaskStatus taskStatus) {

        int maxTries = aiModelConfig.getAudio().getMaxTries();
        int delayMs = aiModelConfig.getAudio().getDelayMs();

        return pollWithScheduler(
                () -> checkAudioResponse(audioId),
                maxTries,
                delayMs,
                taskStatus,
                "Analyzing audio");
    }

    /**
     * Generic polling method using ScheduledExecutorService.
     * Creates a chain of scheduled tasks that check the result supplier.
     *
     * @param resultSupplier Supplier that returns the result or null if not ready
     * @param maxAttempts    Maximum number of polling attempts
     * @param delayMs        Delay between attempts in milliseconds
     * @param taskStatus     Task status for progress updates
     * @param operationName  Name of the operation for logging
     * @return CompletableFuture with the result
     */
    private <T> CompletableFuture<T> pollWithScheduler(
            Supplier<T> resultSupplier,
            int maxAttempts,
            int delayMs,
            TaskStatus taskStatus,
            String operationName) {

        CompletableFuture<T> resultFuture = new CompletableFuture<>();

        // Start the polling chain
        schedulePollingAttempt(
                resultSupplier,
                resultFuture,
                1,
                maxAttempts,
                delayMs,
                taskStatus,
                operationName);

        return resultFuture;
    }

    /**
     * Schedules a single polling attempt and chains to the next if needed.
     */
    private <T> void schedulePollingAttempt(
            Supplier<T> resultSupplier,
            CompletableFuture<T> resultFuture,
            int currentAttempt,
            int maxAttempts,
            int delayMs,
            TaskStatus taskStatus,
            String operationName) {

        if (resultFuture.isDone()) {
            return; // Already completed (possibly cancelled)
        }

        // Schedule the check
        scheduler.schedule(() -> {
            try {
                log.debug("{} - attempt {}/{}", operationName, currentAttempt, maxAttempts);

                // Update task status with progress
                updateTaskProgress(taskStatus, operationName, currentAttempt, maxAttempts);

                // Try to get the result
                T result = resultSupplier.get();

                if (result != null) {
                    // Success! Complete the future
                    log.info("{} completed after {} attempts", operationName, currentAttempt);
                    resultFuture.complete(result);
                } else if (currentAttempt >= maxAttempts) {
                    // Max attempts reached - complete with null
                    log.warn("{} timed out after {} attempts", operationName, maxAttempts);
                    resultFuture.complete(null);
                } else {
                    // Schedule next attempt
                    schedulePollingAttempt(
                            resultSupplier,
                            resultFuture,
                            currentAttempt + 1,
                            maxAttempts,
                            delayMs,
                            taskStatus,
                            operationName);
                }
            } catch (Exception e) {
                log.error("{} failed at attempt {}: {}", operationName, currentAttempt, e.getMessage(), e);
                resultFuture.completeExceptionally(e);
            }
        }, currentAttempt == 1 ? 0 : delayMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Checks if PDF conversion is complete and returns HTML if ready.
     */
    private String checkPdfConversion(String pdfId) {
        try {
            // Check cache first
            var fileConversionStatus = fileConversionStatusService.findByVendorFileId(pdfId);
            if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
                return fileConversionStatus.get().getHtmlText();
            }

            // Try to get converted HTML
            String html = newDocConverterService.getConvertedHtml(pdfId);
            if (html != null) {
                String htmlBody = HtmlParsingUtils.extractBody(html);
                String networkHtml;
                try {
                    networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
                } catch (Exception e) {
                    log.warn("Failed to convert images for pdfId {}: {}", pdfId, e.getMessage());
                    networkHtml = htmlBody; // Fallback
                }
                fileConversionStatusService.updateHtmlText(pdfId, networkHtml);
                return networkHtml;
            }

            return null; // Not ready yet
        } catch (Exception e) {
            log.error("Error checking PDF conversion for {}: {}", pdfId, e.getMessage());
            return null;
        }
    }

    /**
     * Checks if audio conversion is complete and returns text if ready.
     */
    private String checkAudioConversion(String audioId) {
        try {
            var fileConversionStatus = fileConversionStatusService.findByVendorFileId(audioId);
            if (fileConversionStatus.isPresent() && StringUtils.hasText(fileConversionStatus.get().getHtmlText())) {
                return fileConversionStatus.get().getHtmlText();
            }

            String convertedText = newAudioConverterService.getConvertedAudio(audioId);
            if (convertedText != null) {
                fileConversionStatusService.updateHtmlText(audioId, convertedText);
                return convertedText;
            }

            return null; // Not ready yet
        } catch (Exception e) {
            log.error("Error checking audio conversion for {}: {}", audioId, e.getMessage());
            return null;
        }
    }

    /**
     * Checks if audio response is available.
     */
    private AudioConversionDeepLevelResponse checkAudioResponse(String audioId) {
        try {
            AudioConversionDeepLevelResponse response = newAudioConverterService.getConvertedAudioResponse(audioId);

            if (response != null && response.getText() != null) {
                fileConversionStatusService.updateHtmlText(audioId, response.getText());
                return response;
            }

            return null; // Not ready yet
        } catch (Exception e) {
            log.error("Error checking audio response for {}: {}", audioId, e.getMessage());
            return null;
        }
    }

    /**
     * Updates task status with progress information.
     */
    private void updateTaskProgress(TaskStatus taskStatus, String operation, int attempt, int maxAttempts) {
        try {
            taskStatusService.updateTaskStatusAndStatusMessage(
                    taskStatus,
                    TaskStatusEnum.FILE_PROCESSING.name(),
                    taskStatus.getResultJson(),
                    String.format("%s... (attempt %d/%d)", operation, attempt, maxAttempts));
        } catch (Exception e) {
            log.warn("Failed to update task progress: {}", e.getMessage());
        }
    }

    /**
     * Cancels an ongoing polling operation.
     */
    public void cancelPolling(CompletableFuture<?> pollingFuture) {
        if (pollingFuture != null && !pollingFuture.isDone()) {
            pollingFuture.cancel(true);
        }
    }
}
