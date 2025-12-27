package vacademy.io.admin_core_service.features.instructor_copilot.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.CreateInstructorCopilotLogRequest;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.InstructorCopilotLogDTO;
import vacademy.io.admin_core_service.features.instructor_copilot.dto.UpdateInstructorCopilotLogRequest;
import vacademy.io.admin_core_service.features.instructor_copilot.entity.InstructorCopilotLog;
import vacademy.io.admin_core_service.features.instructor_copilot.repository.InstructorCopilotLogRepository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class InstructorCopilotService {

    @Autowired
    private InstructorCopilotLogRepository repository;

    @Autowired
    private InstructorCopilotLLMService llmService;

    public InstructorCopilotLogDTO createLog(CreateInstructorCopilotLogRequest request, String instituteId,
            String userId) {
        InstructorCopilotLog log = InstructorCopilotLog.builder()
                .id(UUID.randomUUID().toString())
                .instituteId(instituteId)
                .createdByUserId(userId)
                .transcriptJson(request.getTranscriptJson())
                .packageSessionId(request.getPackageSessionId())
                .subjectId(request.getSubjectId())
                .status("ACTIVE")
                .build();

        log = repository.save(log);

        // Async LLM Generation
        generateInitialContent(log);

        return new InstructorCopilotLogDTO(log);
    }

    private void generateInitialContent(InstructorCopilotLog log) {
        CompletableFuture.runAsync(() -> {
            try {
                llmService.generateContentFromTranscript(log.getTranscriptJson())
                        .subscribe(jsonNode -> {
                            updateLogWithGeneratedContent(log, jsonNode);
                        }, error -> {
                            System.err.println("Error generating content via LLM: " + error.getMessage());
                            error.printStackTrace();
                        });
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private void updateLogWithGeneratedContent(InstructorCopilotLog log,
            com.fasterxml.jackson.databind.JsonNode jsonNode) {
        try {
            if (jsonNode.has("title")) {
                log.setTitle(jsonNode.get("title").asText());
            }
            if (jsonNode.has("summary")) {
                log.setSummary(jsonNode.get("summary").toString());
            }
            if (jsonNode.has("flashcards")) {
                log.setFlashcardJson(jsonNode.get("flashcards").toString());
            }
            if (jsonNode.has("flashnotes")) {
                log.setFlashnotesJson(jsonNode.get("flashnotes").toString());
            }

            repository.save(log);
        } catch (Exception e) {
            System.err.println("Error saving generated content for log " + log.getId());
            e.printStackTrace();
        }
    }

    public InstructorCopilotLogDTO updateLog(String id, UpdateInstructorCopilotLogRequest request) {
        InstructorCopilotLog log = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Log not found with id: " + id));

        if (request.getTitle() != null)
            log.setTitle(request.getTitle());
        if (request.getThumbnailFileId() != null)
            log.setThumbnailFileId(request.getThumbnailFileId());
        if (request.getTranscriptJson() != null)
            log.setTranscriptJson(request.getTranscriptJson());
        if (request.getFlashnotesJson() != null)
            log.setFlashnotesJson(request.getFlashnotesJson());
        if (request.getSummary() != null)
            log.setSummary(request.getSummary());
        if (request.getQuestionJson() != null)
            log.setQuestionJson(request.getQuestionJson());
        if (request.getFlashcardJson() != null)
            log.setFlashcardJson(request.getFlashcardJson());
        if (request.getSlidesJson() != null)
            log.setSlidesJson(request.getSlidesJson());
        if (request.getVideoJson() != null)
            log.setVideoJson(request.getVideoJson());
        if (request.getStatus() != null)
            log.setStatus(request.getStatus());
        if (request.getPackageSessionId() != null)
            log.setPackageSessionId(request.getPackageSessionId());
        if (request.getSubjectId() != null)
            log.setSubjectId(request.getSubjectId());

        log = repository.save(log);
        return new InstructorCopilotLogDTO(log);
    }

    public void deleteLog(String id) {
        InstructorCopilotLog log = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Log not found with id: " + id));
        log.setStatus("DELETED");
        repository.save(log);
    }

    public List<InstructorCopilotLogDTO> getLogs(String instituteId, String status, Date startDate, Date endDate) {
        Timestamp startTs = new Timestamp(startDate.getTime());

        // Adjust endDate to end of day
        LocalDateTime endDateTime = endDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime();
        endDateTime = endDateTime.withHour(23).withMinute(59).withSecond(59).withNano(999999999);
        Timestamp endTs = Timestamp.valueOf(endDateTime);

        List<InstructorCopilotLog> logs = repository.findLogsByInstituteAndStatusAndDateRange(instituteId, status,
                startTs, endTs);
        return logs.stream().map(InstructorCopilotLogDTO::new).collect(Collectors.toList());
    }

    public InstructorCopilotLogDTO retryGenerateContent(String logId) {
        InstructorCopilotLog log = repository.findById(logId)
                .orElseThrow(() -> new RuntimeException("Log not found with id: " + logId));

        // Retry content generation
        generateInitialContent(log);

        return new InstructorCopilotLogDTO(log);
    }
}
