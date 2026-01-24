package vacademy.io.media_service.controller.task_controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.lecture.LectureFeedbackDto;
import vacademy.io.media_service.dto.lecture.LecturePlanDto;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.exception.TaskProcessingException;
import vacademy.io.media_service.manager.TaskStatusManager;

import vacademy.io.media_service.service.TaskStatusService;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Controller for task status retrieval and results.
 * Provides endpoints for checking task progress and getting results.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/task-status")
public class TaskGetController {

    private final TaskStatusManager taskStatusManager;
    private final TaskStatusService taskStatusService;

    /**
     * Gets all tasks for an institute with optional type filter.
     */
    @GetMapping("/get-all")
    public ResponseEntity<List<TaskStatusDto>> getAllTasks(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "taskType", required = false) String taskType) {

        log.debug("Getting all tasks for institute: {}, type: {}", instituteId, taskType);
        return taskStatusManager.getAllTasks(instituteId, taskType);
    }

    /**
     * Gets the current status of a task.
     */
    @GetMapping("/get-status")
    public ResponseEntity<Map<String, Object>> getTaskStatus(
            @RequestParam("taskId") String taskId) {

        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty()) {
            throw TaskProcessingException.taskNotFound(taskId);
        }

        TaskStatus task = taskStatus.get();

        return ResponseEntity.ok(Map.of(
                "taskId", task.getId(),
                "status", task.getStatus(),
                "statusMessage", task.getStatusMessage() != null ? task.getStatusMessage() : "",
                "type", task.getType() != null ? task.getType() : "",
                "taskName", task.getTaskName() != null ? task.getTaskName() : "",
                "hasResult", task.getResultJson() != null && !task.getResultJson().isEmpty(),
                "createdAt", task.getCreatedAt() != null ? task.getCreatedAt().toString() : "",
                "updatedAt", task.getUpdatedAt() != null ? task.getUpdatedAt().toString() : ""));
    }

    /**
     * Gets question generation results for a task.
     */
    @GetMapping("/get-result")
    public ResponseEntity<AutoQuestionPaperResponse> getAllQuestions(
            @RequestParam("taskId") String taskId) {

        log.debug("Getting results for task: {}", taskId);
        return taskStatusManager.getAllQuestions(taskId);
    }

    /**
     * Gets lecture plan for a task.
     */
    @GetMapping("/get/lecture-plan")
    public ResponseEntity<LecturePlanDto> getLecturePlan(
            @RequestParam("taskId") String taskId) {

        log.debug("Getting lecture plan for task: {}", taskId);
        return taskStatusManager.getLecturePlan(taskId);
    }

    /**
     * Gets lecture feedback for a task.
     */
    @GetMapping("/get/lecture-feedback")
    public ResponseEntity<LectureFeedbackDto> getLectureFeedbackResponse(
            @RequestParam("taskId") String taskId) {

        log.debug("Getting lecture feedback for task: {}", taskId);
        return taskStatusManager.getLectureFeedback(taskId);
    }

    /**
     * Gets raw JSON result for a task.
     */
    @GetMapping("/get-raw-result")
    public ResponseEntity<Map<String, Object>> getRawResult(
            @RequestParam("taskId") String taskId) {

        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty()) {
            throw TaskProcessingException.taskNotFound(taskId);
        }

        TaskStatus task = taskStatus.get();
        String resultJson = task.getResultJson();

        return ResponseEntity.ok(Map.of(
                "taskId", task.getId(),
                "status", task.getStatus(),
                "resultJson", resultJson != null ? resultJson : "",
                "statusMessage", task.getStatusMessage() != null ? task.getStatusMessage() : ""));
    }
}
