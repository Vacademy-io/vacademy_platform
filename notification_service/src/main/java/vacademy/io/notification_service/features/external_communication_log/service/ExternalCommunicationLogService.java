package vacademy.io.notification_service.features.external_communication_log.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.external_communication_log.entity.ExternalCommunicationLog;
import vacademy.io.notification_service.features.external_communication_log.repository.ExternalCommunicationLogRepository;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationSource;
import vacademy.io.notification_service.features.external_communication_log.model.ExternalCommunicationStatus;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExternalCommunicationLogService {

    private final ExternalCommunicationLogRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String start(ExternalCommunicationSource source, String sourceId, Object payload) {
        ExternalCommunicationLog logEntity = new ExternalCommunicationLog();
        logEntity.setSource(source);
        logEntity.setSourceId(sourceId);
        logEntity.setPayloadJson(toJsonSafe(payload));
        logEntity.setStatus(ExternalCommunicationStatus.INITIATED);
        repository.save(logEntity);
        return logEntity.getId();
    }

    public void markSuccess(String logId, Object response) {
        try {
            repository.findById(logId).ifPresent(entity -> {
                entity.setResponseJson(toJsonSafe(response));
                entity.setStatus(ExternalCommunicationStatus.SUCCESS);
                entity.setErrorMessage(null);
                repository.save(entity);
            });
        } catch (Exception e) {
            log.error("Failed to mark success for ExternalCommunicationLog {}: {}", logId, e.getMessage(), e);
        }
    }

    public void markFailure(String logId, String errorMessage, Object response) {
        try {
            repository.findById(logId).ifPresent(entity -> {
                entity.setResponseJson(toJsonSafe(response));
                entity.setStatus(ExternalCommunicationStatus.FAILED);
                entity.setErrorMessage(errorMessage);
                repository.save(entity);
            });
        } catch (Exception e) {
            log.error("Failed to mark failure for ExternalCommunicationLog {}: {}", logId, e.getMessage(), e);
        }
    }

    private String toJsonSafe(Object obj) {
        if (obj == null)
            return null;
        if (obj instanceof String s)
            return s;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{\"_unserializable_\":\"" + obj.toString().replace("\"", "\\\"") + "\"}";
        }
    }
}
