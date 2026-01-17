package vacademy.io.admin_core_service.features.slide.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.slide.dto.ScormTrackingDTO;
import vacademy.io.admin_core_service.features.slide.entity.ScormLearnerProgress;
import vacademy.io.admin_core_service.features.slide.repository.ScormLearnerProgressRepository;

import java.util.UUID;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScormTrackingService {

    private final ScormLearnerProgressRepository scormLearnerProgressRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ScormTrackingDTO initializeSession(String userId, String slideId) {
        // Find latest attempt
        Optional<ScormLearnerProgress> progressOpt = scormLearnerProgressRepository
                .findTopByUserIdAndSlideIdOrderByAttemptNumberDesc(userId, slideId);

        ScormLearnerProgress progress;
        if (progressOpt.isPresent()) {
            progress = progressOpt.get();
            // Optional: Logic to decide if we need a new attempt (e.g., if previous was
            // completed)
            // For simplicity, we reuse the attempt if not strictly completed/finalized, or
            // create new if needed.
            // Here we just return the latest state to resume.
        } else {
            // Create first attempt
            progress = new ScormLearnerProgress();
            progress.setId(UUID.randomUUID().toString());
            progress.setUserId(userId);
            progress.setSlideId(slideId);
            progress.setAttemptNumber(1);
            progress.setCompletionStatus("not attempted");
            progress.setSuccessStatus("unknown");
            progress = scormLearnerProgressRepository.save(progress);
        }

        return mapToDTO(progress);
    }

    @Transactional
    public void commitSession(String userId, String slideId, ScormTrackingDTO trackingDTO) {
        Optional<ScormLearnerProgress> progressOpt = scormLearnerProgressRepository
                .findTopByUserIdAndSlideIdOrderByAttemptNumberDesc(userId, slideId);

        if (progressOpt.isEmpty()) {
            throw new RuntimeException("No active session found for committing. Call initialize first.");
        }

        ScormLearnerProgress progress = progressOpt.get();
        updateProgressFromDTO(progress, trackingDTO);
        scormLearnerProgressRepository.save(progress);
    }

    private ScormTrackingDTO mapToDTO(ScormLearnerProgress progress) {
        return ScormTrackingDTO.builder()
                .cmiSuspendData(progress.getCmiSuspendData())
                .cmiLocation(progress.getCmiLocation())
                .cmiExit(progress.getCmiExit())
                .completionStatus(progress.getCompletionStatus())
                .successStatus(progress.getSuccessStatus())
                .scoreRaw(progress.getScoreRaw())
                .scoreMin(progress.getScoreMin())
                .scoreMax(progress.getScoreMax())
                .totalTime(progress.getTotalTime())
                // cmiJson is a string in DB, assume parsing handled by caller or simple mapping
                // if needed.
                // But DTO has Map<String, Object>.
                .cmiJson(parseJson(progress.getCmiJson()))
                .build();
    }

    private void updateProgressFromDTO(ScormLearnerProgress progress, ScormTrackingDTO dto) {
        if (dto.getCmiSuspendData() != null)
            progress.setCmiSuspendData(dto.getCmiSuspendData());
        if (dto.getCmiLocation() != null)
            progress.setCmiLocation(dto.getCmiLocation());
        if (dto.getCmiExit() != null)
            progress.setCmiExit(dto.getCmiExit());
        if (dto.getCompletionStatus() != null)
            progress.setCompletionStatus(dto.getCompletionStatus());
        if (dto.getSuccessStatus() != null)
            progress.setSuccessStatus(dto.getSuccessStatus());
        if (dto.getScoreRaw() != null)
            progress.setScoreRaw(dto.getScoreRaw());
        if (dto.getScoreMin() != null)
            progress.setScoreMin(dto.getScoreMin());
        if (dto.getScoreMax() != null)
            progress.setScoreMax(dto.getScoreMax());
        if (dto.getTotalTime() != null)
            progress.setTotalTime(dto.getTotalTime());
        if (dto.getCmiJson() != null)
            progress.setCmiJson(toJson(dto.getCmiJson()));
    }

    private java.util.Map<String, Object> parseJson(String json) {
        if (json == null)
            return null;
        try {
            return objectMapper.readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {
                    });
        } catch (JsonProcessingException e) {
            log.error("Failed to parse CMI JSON", e);
            return null;
        }
    }

    private String toJson(java.util.Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            log.error("Failed to write CMI JSON", e);
            return null;
        }
    }
}
