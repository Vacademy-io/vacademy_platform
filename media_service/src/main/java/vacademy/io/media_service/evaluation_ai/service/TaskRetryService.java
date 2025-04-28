package vacademy.io.media_service.evaluation_ai.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserResponse;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;
import vacademy.io.media_service.evaluation_ai.enums.EvaluationUserSourceEnum;
import vacademy.io.media_service.evaluation_ai.repository.UserEvaluationRepository;
import vacademy.io.media_service.service.TaskStatusService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TaskRetryService {

    @Autowired
    TaskStatusService taskStatusService;


    public void asyncRetryTask(TaskStatus newTask, String oldDynamicMap) {
        String initialResultJson = "";
        Integer retryCount = 0;
        new Thread(() -> handleRetryInBackground(newTask, oldDynamicMap, retryCount)).start();

    }

    private void handleRetryInBackground(TaskStatus newTask, String oldDynamicMap, Integer retryCount) {

    }
}
