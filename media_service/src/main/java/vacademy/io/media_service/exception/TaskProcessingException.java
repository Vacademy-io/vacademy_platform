package vacademy.io.media_service.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception for task processing errors.
 * Used when task creation, update, or retrieval fails.
 */
public class TaskProcessingException extends AiProcessingException {

    public TaskProcessingException(String message) {
        super("TASK_PROCESSING_ERROR",
                "Failed to process your task. Please try again or contact support.",
                message);
    }

    public TaskProcessingException(String message, Throwable cause) {
        super("TASK_PROCESSING_ERROR",
                "Failed to process your task. Please try again or contact support.",
                message,
                cause);
    }

    public TaskProcessingException(String taskId, String operation, String reason) {
        super("TASK_PROCESSING_ERROR",
                String.format("Task operation '%s' failed. %s", operation, reason),
                String.format("Task ID: %s, Operation: %s, Reason: %s", taskId, operation, reason));
    }

    public static TaskProcessingException taskNotFound(String taskId) {
        return new TaskProcessingException(
                "TASK_NOT_FOUND",
                String.format("Task with ID '%s' was not found. It may have expired or been deleted.", taskId),
                String.format("Task not found: %s", taskId),
                HttpStatus.NOT_FOUND);
    }

    public static TaskProcessingException taskFailed(String taskId, String reason) {
        return new TaskProcessingException(
                "TASK_FAILED",
                String.format("Task processing failed: %s. Please retry or try with different input.", reason),
                String.format("Task %s failed: %s", taskId, reason),
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public static TaskProcessingException taskTimeout(String taskId) {
        return new TaskProcessingException(
                "TASK_TIMEOUT",
                "Task processing took too long. Please try with smaller input or try again later.",
                String.format("Task %s timed out", taskId),
                HttpStatus.REQUEST_TIMEOUT);
    }

    public TaskProcessingException(String errorCode, String userMessage, String technicalDetails, HttpStatus status) {
        super(errorCode, userMessage, technicalDetails, status);
    }
}
