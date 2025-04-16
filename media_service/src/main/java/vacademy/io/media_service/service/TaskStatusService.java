package vacademy.io.media_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.enums.TaskStatus;
import vacademy.io.media_service.repository.TaskStatusRepository;

import java.util.List;
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

    public List<TaskStatus> getTaskStatusesByInputType(String inputType) {
        return taskStatusRepository.findByInputType(inputType);
    }
}
