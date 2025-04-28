package vacademy.io.media_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.dto.chat_with_pdf.ChatWithPdfResponse;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;
import vacademy.io.media_service.entity.TaskStatus;
import vacademy.io.media_service.enums.TaskStatusEnum;
import vacademy.io.media_service.repository.TaskStatusRepository;
import vacademy.io.media_service.service.pdf_covert.ConversationDto;

import java.util.*;

@Slf4j
@Service
public class TaskStatusService {

    private final TaskStatusRepository taskStatusRepository;

    @Autowired
    public TaskStatusService(TaskStatusRepository taskStatusRepository) {
        this.taskStatusRepository = taskStatusRepository;
    }

    @Autowired
    private ObjectMapper objectMapper;

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
        return taskStatusRepository.findByInstituteIdAndTypeOrderByCreatedAtDesc(instituteId, taskType);
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

    public void updateTaskStatusAndStatusMessage(TaskStatus taskStatus, String status,String resultJson, String statusMessage) {
        updateIfNotNull(status,taskStatus::setStatus);
        updateIfNotNull(resultJson,taskStatus::setResultJson);
        updateIfNotNull(statusMessage,taskStatus::setStatusMessage);
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

    public String getLast5ConversationFromInputIdAndInputType(String instituteId, String type, String inputId, String inputType) {
        List<TaskStatus> taskStatuses = taskStatusRepository
                .findLastFiveByTypeAndInstituteAndInput(type, instituteId, inputId, inputType);

        // Sort from oldest to newest
        taskStatuses.sort(Comparator.comparing(TaskStatus::getCreatedAt));

        List<ConversationDto> conversations = new ArrayList<>();

        for (TaskStatus task : taskStatuses) {
            try {
                JsonNode jsonNode = objectMapper.readTree(task.getResultJson());
                String user = jsonNode.path("user").asText();
                String aiResponse = jsonNode.path("response").asText();

                conversations.add(new ConversationDto(user, aiResponse, task.getCreatedAt()));
            } catch (Exception e) {
                // Optionally log invalid/malformed JSON
                log.error("ERROR AT CONVERSATION: "+e.getMessage());
            }
        }

        try {
            return objectMapper.writeValueAsString(conversations);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Error serializing conversation list to JSON", e);
        }
    }

    public TaskStatus createNewTaskForResult(String instituteId, String type, String inputId, String inputType, String rawOutput,String taskName, String parentId) {
        TaskStatus taskStatus = new TaskStatus();
        taskStatus.setStatus(TaskStatusEnum.COMPLETED.name());
        taskStatus.setType(type);
        taskStatus.setInputId(inputId);
        taskStatus.setInputType(inputType);
        taskStatus.setTaskName(taskName);
        taskStatus.setInstituteId(instituteId);
        taskStatus.setResultJson(rawOutput);
        taskStatus.setParentId(parentId);
        return taskStatusRepository.save(taskStatus);
    }

    public List<ChatWithPdfResponse> getChatResponseForTypeAndInputId(String type, String inputType, String inputId, String instituteId) {
        List<ChatWithPdfResponse> response = new ArrayList<>();
        List<TaskStatus> allTask = taskStatusRepository.findByTypeAndInstituteIdAndInputIdAndInputTypeOrderByASC(type,instituteId,inputId,inputType);
        allTask.forEach(task->{
            try{
                response.add(task.getPdfChatResponse());
            }
            catch (Exception e){
                log.error("Failed To convert: " +e.getMessage()) ;
            }
        });
        return response;
    }

    public List<TaskStatus> getAllTaskFromParentIdAndWithParentId(String parentId) {
        return taskStatusRepository.findByParentIdAndTaskWithParentId(parentId);
    }

    public List<TaskStatus> getTaskStatusesByInstituteIdAndNoParentId(String instituteId) {
        return taskStatusRepository.findByInstituteIdAndNullParentId(instituteId);
    }

    public void convertMapToJsonAndStore(Map<String, Object> map, TaskStatus taskStatus)throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        String jsonMap =  objectMapper.writeValueAsString(map);
        taskStatus.setDynamicValuesMap(jsonMap);
        taskStatusRepository.save(taskStatus);
    }
}
