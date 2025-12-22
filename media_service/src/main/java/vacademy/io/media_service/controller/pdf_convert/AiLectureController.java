package vacademy.io.media_service.controller.pdf_convert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.config.AiModelConfig;
import vacademy.io.media_service.manager.AiLectureManager;

import java.util.Map;

/**
 * Controller for AI lecture-related operations.
 * Supports model selection for lecture planning and feedback.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/lecture")
public class AiLectureController {

    private final AiLectureManager aiLectureManager;
    private final AiModelConfig aiModelConfig;

    /**
     * Generates a lecture plan based on user input.
     * 
     * @param userPrompt       The topic/content for the lecture
     * @param lectureDuration  Duration of the lecture (e.g., "45 minutes")
     * @param language         Language for the lecture plan
     * @param methodOfTeaching Teaching method (e.g., "interactive", "lecture")
     * @param taskName         Name for tracking this task
     * @param instituteId      Institute identifier
     * @param level            Class/skill level
     * @param preferredModel   Optional: AI model to use
     * @return Task ID for tracking progress
     */
    @GetMapping("/generate-plan")
    public ResponseEntity<Map<String, Object>> getLecturePlanner(
            @RequestParam("userPrompt") String userPrompt,
            @RequestParam("lectureDuration") String lectureDuration,
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "methodOfTeaching", required = false) String methodOfTeaching,
            @RequestParam("taskName") String taskName,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "level", required = false) String level,
            @RequestParam(value = "preferredModel", required = false) String preferredModel) {

        String model = aiModelConfig.getModelToUse(preferredModel);

        String taskId = aiLectureManager.generateLecturePlanner(
                userPrompt, lectureDuration, language, methodOfTeaching,
                taskName, instituteId, level, model);

        log.info("Started lecture planner: taskId={}, model={}", taskId, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "status", "STARTED",
                "model", model,
                "message", "Lecture plan generation started"));
    }

    /**
     * Generates feedback for a lecture from audio transcription.
     * 
     * @param audioId        The audio file ID
     * @param instituteId    Institute identifier
     * @param taskName       Name for tracking this task
     * @param preferredModel Optional: AI model to use
     * @return Task ID for tracking progress
     */
    @GetMapping("/generate-feedback")
    public ResponseEntity<Map<String, Object>> getLectureFeedback(
            @RequestParam("audioId") String audioId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam("taskName") String taskName,
            @RequestParam(value = "preferredModel", required = false) String preferredModel) {

        String model = aiModelConfig.getModelToUse(preferredModel);

        String taskId = aiLectureManager.generateLectureFeedback(
                audioId, instituteId, taskName, model);

        log.info("Started lecture feedback: taskId={}, audioId={}, model={}", taskId, audioId, model);

        return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "audioId", audioId,
                "status", "STARTED",
                "model", model,
                "message", "Lecture feedback generation started"));
    }
}
