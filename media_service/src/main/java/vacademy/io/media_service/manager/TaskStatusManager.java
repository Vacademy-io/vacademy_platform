package vacademy.io.media_service.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.lecture.LectureFeedbackDto;
import vacademy.io.media_service.dto.lecture.LecturePlanDto;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.service.ResponseConverterService;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Component
public class TaskStatusManager {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    ResponseConverterService responseConverterService;

    public ResponseEntity<List<TaskStatusDto>> getAllTasks(String instituteId, String taskType) {
        List<TaskStatusDto> allTaskStatus = taskStatusService.getAllTaskStatusDtoForInstituteIdAndTaskType(instituteId,
                taskType);
        return ResponseEntity.ok(allTaskStatus);
    }

    public ResponseEntity<AutoQuestionPaperResponse> getAllQuestions(String taskId) {
        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty())
            throw new VacademyException("Task Not Found");

        String resultJson = taskStatus.get().getResultJson();
        if (Objects.isNull(resultJson) || resultJson.isEmpty())
            return ResponseEntity.ok(new AutoQuestionPaperResponse());

        try {
            return ResponseEntity.ok(responseConverterService.convertToQuestionPaperResponse(resultJson));
        } catch (Exception e) {
            return ResponseEntity.ok(new AutoQuestionPaperResponse());
        }
    }

    public ResponseEntity<LecturePlanDto> getLecturePlan(String taskId) {
        Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
        if (taskStatus.isEmpty())
            throw new VacademyException("Task Not Found");

        String resultJson = taskStatus.get().getResultJson();
        if (Objects.isNull(resultJson) || resultJson.isEmpty())
            return ResponseEntity.ok(new LecturePlanDto());

        try {
            return ResponseEntity.ok(responseConverterService.convertToLecturePlanDto(resultJson));

        } catch (Exception e) {
            return ResponseEntity.ok(new LecturePlanDto());
        }
    }

    public ResponseEntity<LectureFeedbackDto> getLectureFeedback(String taskId) {
        try {
            Optional<TaskStatus> taskStatus = taskStatusService.getTaskStatusById(taskId);
            if (taskStatus.isEmpty())
                throw new VacademyException(HttpStatus.NOT_FOUND, "Task Not Found");

            return ResponseEntity.ok(taskStatus.get().getLectureFeedbackDto());
        } catch (Exception e) {
            return ResponseEntity.ok(new LectureFeedbackDto());
        }
    }
}
