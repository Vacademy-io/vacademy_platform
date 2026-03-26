package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowSchedule;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowScheduleService;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduleTaskNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final WorkflowScheduleService workflowScheduleService;

    @Override
    public boolean supports(String nodeType) {
        return "SCHEDULE_TASK".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            String delayDuration = config.path("delayDuration").asText("PT1H"); // ISO-8601 duration
            String targetWorkflowId = config.path("workflowId").asText("");

            // If no target workflow specified, use the current workflow
            if (targetWorkflowId.isBlank()) {
                targetWorkflowId = (String) context.getOrDefault("workflowId", "");
            }

            if (targetWorkflowId.isBlank()) {
                result.put("error", "No target workflow ID specified");
                return result;
            }

            // Dry-run check
            Boolean dryRun = (Boolean) context.getOrDefault("dryRun", false);
            if (Boolean.TRUE.equals(dryRun)) {
                log.info("[DRY RUN] SCHEDULE_TASK: would schedule workflow {} after {}", targetWorkflowId, delayDuration);
                result.put("dryRun", true);
                result.put("skipped", "schedule_task");
                result.put("targetWorkflowId", targetWorkflowId);
                result.put("delayDuration", delayDuration);
                return result;
            }

            Duration duration = Duration.parse(delayDuration);
            Instant scheduledTime = Instant.now().plus(duration);

            // Create a one-time schedule
            WorkflowSchedule schedule = new WorkflowSchedule();
            schedule.setId(UUID.randomUUID().toString());
            schedule.setWorkflowId(targetWorkflowId);
            schedule.setScheduleType("ONE_TIME");
            schedule.setTimezone("UTC");
            schedule.setStartDate(scheduledTime);
            schedule.setEndDate(scheduledTime.plus(Duration.ofMinutes(5))); // Small window
            schedule.setStatus("ACTIVE");
            schedule.setCreatedAt(Instant.now());
            schedule.setUpdatedAt(Instant.now());

            WorkflowSchedule created = workflowScheduleService.createSchedule(schedule);

            log.info("SCHEDULE_TASK: created schedule {} for workflow {} at {}",
                    created.getId(), targetWorkflowId, scheduledTime);

            result.put("scheduleId", created.getId());
            result.put("targetWorkflowId", targetWorkflowId);
            result.put("scheduledAt", scheduledTime.toString());
            result.put("delayDuration", delayDuration);

        } catch (Exception e) {
            log.error("Error in ScheduleTaskNodeHandler", e);
            result.put("error", "ScheduleTaskNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
