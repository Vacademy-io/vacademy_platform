package vacademy.io.media_service.controller.pdf_convert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.config.AiModelConfig;
import vacademy.io.media_service.dto.AutoDocumentSubmitResponse;
import vacademy.io.media_service.dto.FileIdSubmitRequest;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskInputTypeEnum;
import vacademy.io.media_service.enums.TaskStatusTypeEnum;
import vacademy.io.media_service.exception.FileConversionException;
import vacademy.io.media_service.service.*;

import java.io.IOException;
import java.util.Map;

/**
 * Controller for audio-based question generation.
 * Supports transcription to questions with model selection.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/get-question-audio")
public class AudioQuestionGeneratorController {

    private final DeepSeekAsyncTaskService deepSeekAsyncTaskService;
    private final TaskStatusService taskStatusService;
    private final FileService fileService;
    private final FileConversionStatusService fileConversionStatusService;
    private final NewAudioConverterService newAudioConverterService;
    private final AiModelConfig aiModelConfig;

    // Default values
    private static final String DEFAULT_DIFFICULTY = "hard and medium";
    private static final String DEFAULT_NUM_QUESTIONS = "20";
    private static final String DEFAULT_LANGUAGE = "english";

    // ==================== Audio Upload & Processing ====================

    /**
     * Starts audio processing by uploading file.
     */
    @PostMapping("/audio-parser/start-process-audio")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessAudio(
            @RequestParam("file") MultipartFile file) {

        try {
            FileDetailsDTO fileDetailsDTO = fileService.uploadFileWithDetails(file);
            if (ObjectUtils.isEmpty(fileDetailsDTO) || !StringUtils.hasText(fileDetailsDTO.getUrl())) {
                throw FileConversionException.uploadFailed(file.getOriginalFilename());
            }

            String audioId = newAudioConverterService.startProcessing(fileDetailsDTO.getUrl());
            if (!StringUtils.hasText(audioId)) {
                throw FileConversionException.conversionFailed(fileDetailsDTO.getId(),
                        "Failed to start audio processing");
            }

            fileConversionStatusService.startProcessing(audioId, "assemblyai", fileDetailsDTO.getId());

            log.info("Started audio processing: audioId={}, fileId={}", audioId, fileDetailsDTO.getId());
            return ResponseEntity.ok(new AutoDocumentSubmitResponse(audioId));

        } catch (FileConversionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start audio processing: {}", e.getMessage(), e);
            throw FileConversionException.uploadFailed(file.getOriginalFilename());
        }
    }

    /**
     * Starts audio processing from existing file ID.
     */
    @PostMapping("/audio-parser/start-process-audio-file-id")
    public ResponseEntity<AutoDocumentSubmitResponse> startProcessAudioFromFileId(
            @RequestBody FileIdSubmitRequest request) {

        try {
            var fileDetailsDTOs = fileService.getMultipleFileDetailsWithExpiryAndId(request.getFileId(), 7);
            if (ObjectUtils.isEmpty(fileDetailsDTOs) || fileDetailsDTOs.isEmpty()) {
                throw FileConversionException.uploadFailed(request.getFileId());
            }

            String audioId = newAudioConverterService.startProcessing(fileDetailsDTOs.get(0).getUrl());
            if (!StringUtils.hasText(audioId)) {
                throw FileConversionException.conversionFailed(request.getFileId(), "Failed to start audio processing");
            }

            fileConversionStatusService.startProcessing(audioId, "assemblyai", fileDetailsDTOs.get(0).getId());

            log.info("Started audio processing from fileId: audioId={}", audioId);
            return ResponseEntity.ok(new AutoDocumentSubmitResponse(audioId));

        } catch (FileConversionException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to start audio processing from fileId: {}", e.getMessage(), e);
            throw FileConversionException.uploadFailed(request.getFileId());
        }
    }

    // ==================== Question Generation ====================

    /**
     * Generates questions from audio with optional model selection.
     */
    /**
     * Generates questions from audio with optional model selection.
     */
    @GetMapping("/audio-parser/audio-to-questions")
    public ResponseEntity<Map<String, Object>> getAudioToQuestions(
            @RequestParam String audioId,
            @RequestParam(required = false) String numQuestions,
            @RequestParam(required = false) String prompt,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String language,
            @RequestParam(name = "taskId", required = false) String taskId,
            @RequestParam(name = "taskName", required = false) String taskName,
            @RequestParam(name = "instituteId", required = false) String instituteId,
            @RequestParam(name = "preferredModel", required = false) String preferredModel,
            @RequestParam(name = "generateImage", required = false, defaultValue = "false") Boolean generateImage)
            throws IOException {

        // Apply defaults
        String actualDifficulty = StringUtils.hasText(difficulty) ? difficulty : DEFAULT_DIFFICULTY;
        String actualNumQuestions = StringUtils.hasText(numQuestions) ? numQuestions : DEFAULT_NUM_QUESTIONS;
        String actualPrompt = StringUtils.hasText(prompt) ? prompt : "";
        String actualLanguage = StringUtils.hasText(language) ? language : DEFAULT_LANGUAGE;

        String model = aiModelConfig.getModelToUse(preferredModel);

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                taskId,
                TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name(),
                audioId,
                TaskInputTypeEnum.AUDIO_ID.name(),
                taskName,
                instituteId);

        deepSeekAsyncTaskService.pollAndProcessAudioToQuestions(
                taskStatus,
                audioId,
                actualPrompt,
                actualDifficulty,
                actualLanguage,
                actualNumQuestions,
                model,
                generateImage);

        log.info("Started audio to questions: taskId={}, audioId={}, model={}",
                taskStatus.getId(), audioId, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED",
                "model", model,
                "numQuestions", actualNumQuestions,
                "difficulty", actualDifficulty,
                "language", actualLanguage,
                "message", "Question generation from audio started"));
    }

    /**
     * Enhanced endpoint with POST for more options.
     */
    @PostMapping("/audio-parser/audio-to-questions")
    public ResponseEntity<Map<String, Object>> postAudioToQuestions(
            @RequestBody AudioToQuestionsRequest request) throws IOException {

        // Apply defaults
        String audioId = request.getAudioId();
        String difficulty = StringUtils.hasText(request.getDifficulty()) ? request.getDifficulty() : DEFAULT_DIFFICULTY;
        String numQuestions = request.getNumQuestions() != null ? request.getNumQuestions().toString()
                : DEFAULT_NUM_QUESTIONS;
        String prompt = StringUtils.hasText(request.getPrompt()) ? request.getPrompt() : "";
        String language = StringUtils.hasText(request.getLanguage()) ? request.getLanguage() : DEFAULT_LANGUAGE;
        Boolean generateImage = Boolean.TRUE.equals(request.getGenerateImage());

        String model = aiModelConfig.getModelToUse(request.getPreferredModel());

        TaskStatus taskStatus = taskStatusService.updateTaskStatusOrCreateNewTask(
                request.getTaskId(),
                TaskStatusTypeEnum.AUDIO_TO_QUESTIONS.name(),
                audioId,
                TaskInputTypeEnum.AUDIO_ID.name(),
                request.getTaskName(),
                request.getInstituteId());

        deepSeekAsyncTaskService.pollAndProcessAudioToQuestions(
                taskStatus,
                audioId,
                prompt,
                difficulty,
                language,
                numQuestions,
                model,
                generateImage);

        log.info("Started audio to questions (POST): taskId={}, audioId={}, model={}",
                taskStatus.getId(), audioId, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskStatus.getId(),
                "status", "STARTED",
                "model", model,
                "message", "Question generation from audio started"));
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AudioToQuestionsRequest {
        private String audioId;
        private Integer numQuestions;
        private String prompt;
        private String difficulty;
        private String language;
        private String taskId;
        private String taskName;
        private String instituteId;
        private String preferredModel;
        private Boolean generateImage;
    }
}
