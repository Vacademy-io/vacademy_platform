package vacademy.io.media_service.controller.retry_controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.evaluation_ai.service.TaskRetryService;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.Optional;

@RestController
@RequestMapping("/media-service/ai/retry")
public class RetryController {

    @Autowired
    TaskStatusService taskStatusService;

    @Autowired
    TaskRetryService taskRetryService;

    @PostMapping("/task")
    public ResponseEntity<TaskStatus> retryTask(@RequestParam("taskId") String taskId, @RequestBody(required = false) Object retryRequestBody) {

        Optional<TaskStatus> oldTaskStatus = taskStatusService.getTaskStatusById(taskId);

        if (oldTaskStatus.isEmpty() || oldTaskStatus.get().getDynamicValuesMap().isEmpty()) {
            throw new VacademyException("Task not found");
        }


        TaskStatus newTask = taskStatusService.updateTaskStatusOrCreateNewTask(null, oldTaskStatus.get().getType(), oldTaskStatus.get().getInputId(), oldTaskStatus.get().getInputType(), oldTaskStatus.get().getTaskName() + "_retry", oldTaskStatus.get().getInstituteId());
        //taskRetryService.asyncRetryTask(newTask);
        return ResponseEntity.ok(newTask);
    }


}
