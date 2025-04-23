package vacademy.io.media_service.controller.task_controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.AutoQuestionPaperResponse;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.manager.TaskStatusManager;

import java.util.List;

@RestController
@RequestMapping("/media-service/task-status")
public class TaskGetController {

    @Autowired
    TaskStatusManager taskStatusManager;


    @GetMapping("/get-all")
    public ResponseEntity<List<TaskStatusDto>> getAllTasks(@RequestParam("instituteId") String instituteId,
                                                           @RequestParam("taskType") String taskType){
        return taskStatusManager.getAllTasks(instituteId,taskType);
    }

    @GetMapping("/get-result")
    public ResponseEntity<AutoQuestionPaperResponse> getAllQuestions(@RequestParam("taskId") String taskId){
        return taskStatusManager.getAllQuestions(taskId);
    }
}
