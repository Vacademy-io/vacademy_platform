package vacademy.io.media_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.repository.TaskStatusRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class TaskStatusService {

    private final TaskStatusRepository taskStatusRepository;

    @Autowired
    public TaskStatusService(TaskStatusRepository taskStatusRepository) {
        this.taskStatusRepository = taskStatusRepository;
    }

    public TaskStatus saveTaskStatus(TaskStatus taskStatus) {
        return taskStatusRepository.save(taskStatus);
    }

    public Optional<TaskStatus> getTaskStatusById(String id) {
        return taskStatusRepository.findById(id);
    }

    public List<TaskStatus> getAllTaskStatuses() {
        return taskStatusRepository.findAll();
    }

    public void deleteTaskStatus(String id) {
        taskStatusRepository.deleteById(id);
    }

    public List<TaskStatus> getTaskStatusesByStatus(String status) {
        return taskStatusRepository.findByStatus(status);
    }

    public List<TaskStatus> getTaskStatusesByInstituteId(String instituteId) {
        return taskStatusRepository.findByInstituteId(instituteId);
    }

    public List<TaskStatus> getTaskStatusesByInstituteIdAndTaskType(String instituteId, String taskType) {
        return taskStatusRepository.findByInstituteIdAndType(instituteId, taskType);
    }

    public List<TaskStatus> getTaskStatusesByInputType(String inputType) {
        return taskStatusRepository.findByInputType(inputType);
    }

    public String getResultJsonFromTaskId(String taskId) {
        Optional<TaskStatus> taskStatus = taskStatusRepository.findById(taskId);
        return taskStatus.filter(status -> status.getResultJson() != null).map(TaskStatus::getResultJson).orElse("");

    }

    public TaskStatus updateTaskStatusOrCreateNewTask(String taskId, String type, String inputId, String inputType,String taskName,String instituteId) {
        if(Objects.isNull(taskId)){
            return createNewTask(type,inputId,inputType,taskName,instituteId);
        }

        Optional<TaskStatus> taskStatus = taskStatusRepository.findById(taskId);
        if(taskStatus.isEmpty()){
            return createNewTask(type,inputId,inputType,taskName,instituteId);
        }

        taskStatus.get().setStatus("PROGRESS");
        return taskStatusRepository.save(taskStatus.get());
    }

    private TaskStatus createNewTask(String type, String inputId, String inputType,String taskName,String instituteId) {
        TaskStatus taskStatus = new TaskStatus();
        taskStatus.setStatus("PROGRESS");
        taskStatus.setType(type);
        taskStatus.setInputId(inputId);
        taskStatus.setInputType(inputType);
        taskStatus.setTaskName(taskName);
        taskStatus.setInstituteId(instituteId);
        return taskStatusRepository.save(taskStatus);
    }

    public void updateTaskStatus(TaskStatus taskStatus, String status,String resultJson) {
        updateIfNotNull(status,taskStatus::setStatus);
        updateIfNotNull(resultJson,taskStatus::setResultJson);
        taskStatusRepository.save(taskStatus);
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }

    public List<TaskStatusDto> getAllTaskStatusDtoForInstituteIdAndTaskType(String instituteId, String taskType) {
        List<TaskStatusDto> responses = new ArrayList<>();
        getTaskStatusesByInstituteIdAndTaskType(instituteId,taskType).forEach(task->{
            responses.add(task.getTaskDto());
        });

        return responses;
    }
}
