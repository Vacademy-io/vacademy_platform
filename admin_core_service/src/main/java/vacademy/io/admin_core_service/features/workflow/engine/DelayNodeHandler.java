package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecutionState;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionStateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class DelayNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final WorkflowExecutionStateRepository executionStateRepository;
    private final WorkflowExecutionRepository executionRepository;
    private static final long MAX_INLINE_DELAY_MS = 60_000; // Max 1 minute inline delay

    @Override
    public boolean supports(String nodeType) {
        return "DELAY".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            JsonNode delayNode = config.path("delay");

            long value = delayNode.path("value").asLong(0);
            String unit = delayNode.path("unit").asText("SECONDS").toUpperCase();

            long delayMs;
            String delayDescription;
            if ("NEXT_DAY_OF_WEEK".equalsIgnoreCase(delayNode.path("until").asText(null))) {
                // "Wait until the next <weekday> at <time>" — e.g. a trial drip that must start
                // on Monday regardless of which day the learner signed up. Default semantics are
                // STRICTLY next: signing up on a Monday waits for the following Monday, unless
                // includeSameDay=true and the target time today is still ahead.
                DayOfWeek targetDay = DayOfWeek.valueOf(delayNode.path("dayOfWeek").asText("MONDAY").toUpperCase());
                LocalTime targetTime = LocalTime.parse(delayNode.path("time").asText("09:00"));
                ZoneId zone = ZoneId.of(delayNode.path("timezone").asText("Asia/Kolkata"));
                boolean includeSameDay = delayNode.path("includeSameDay").asBoolean(false);

                ZonedDateTime now = ZonedDateTime.now(zone);
                ZonedDateTime target = now.with(TemporalAdjusters.next(targetDay)).with(targetTime);
                if (includeSameDay && now.getDayOfWeek() == targetDay) {
                    ZonedDateTime todayAtTime = now.with(targetTime);
                    if (todayAtTime.isAfter(now)) {
                        target = todayAtTime;
                    }
                }
                delayMs = Duration.between(now, target).toMillis();
                delayDescription = "until next " + targetDay + " " + targetTime + " " + zone + " (" + target + ")";
                result.put("delayUntil", target.toString());
            } else {
                delayMs = switch (unit) {
                    case "MINUTES" -> TimeUnit.MINUTES.toMillis(value);
                    case "HOURS" -> TimeUnit.HOURS.toMillis(value);
                    case "DAYS" -> TimeUnit.DAYS.toMillis(value);
                    default -> TimeUnit.SECONDS.toMillis(value);
                };
                delayDescription = value + " " + unit;
            }

            // H1 FIX: when the engine resumes a paused execution it re-enters at THIS delay node
            // (the one we paused on) and sets __skip_delay_once for this single execution. The wait
            // has already elapsed via WorkflowResumeJob's scheduling, so do not re-wait/re-pause —
            // just complete the node and let routing carry the workflow forward.
            if (Boolean.TRUE.equals(context.get("__skip_delay_once"))) {
                log.info("DELAY node: resumed after persistent delay ({}). Skipping wait and continuing.", delayDescription);
                result.put("delayed", true);
                result.put("delaySkippedOnResume", true);
                return result;
            }

            Boolean dryRun = (Boolean) context.getOrDefault("dryRun", false);
            if (Boolean.TRUE.equals(dryRun)) {
                log.info("[DRY RUN] DELAY node - would wait {} ({} ms)", delayDescription, delayMs);
                result.put("dryRun", true);
                result.put("skipped", "delay");
                result.put("delayMs", delayMs);
                return result;
            }

            if (delayMs <= 0) {
                log.info("DELAY node: no delay configured, skipping");
                return result;
            }

            if (delayMs <= MAX_INLINE_DELAY_MS) {
                // Short delay — inline Thread.sleep
                log.info("DELAY node: waiting {} ({} ms) inline", delayDescription, delayMs);
                Thread.sleep(delayMs);
                result.put("delayed", true);
                result.put("delayMs", delayMs);
            } else {
                // Long delay — persist state and pause workflow
                log.info("DELAY node: {} ({} ms) exceeds inline limit. Persisting state for resume.",
                        delayDescription, delayMs);

                String executionId = (String) context.get("executionId");
                String currentNodeId = (String) context.get("currentNodeId");

                if (executionId == null) {
                    log.warn("No executionId in context — cannot persist delay. Executing immediately.");
                    result.put("delayed", false);
                    result.put("delayMs", delayMs);
                    result.put("warning", "No executionId for persistent delay. Executed immediately.");
                    return result;
                }

                // Create execution state record
                Instant resumeAt = Instant.now().plusMillis(delayMs);
                WorkflowExecutionState state = WorkflowExecutionState.builder()
                        .executionId(executionId)
                        .pausedAtNodeId(currentNodeId)
                        .serializedContext(new HashMap<>(context))
                        .resumeAt(resumeAt)
                        .pauseReason("DELAY")
                        .status("WAITING")
                        .build();
                executionStateRepository.save(state);

                // Mark the execution as PAUSED
                executionRepository.findById(executionId).ifPresent(execution -> {
                    execution.setStatus(vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus.PAUSED);
                    executionRepository.save(execution);
                });

                log.info("DELAY node: workflow paused. Will resume at {} ({})",
                        resumeAt, delayDescription);

                // Signal engine to stop processing
                result.put("__workflow_paused", true);
                result.put("delayed", true);
                result.put("delayMs", delayMs);
                result.put("resumeAt", resumeAt.toString());
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("DELAY node interrupted", e);
            result.put("error", "Delay interrupted");
        } catch (Exception e) {
            log.error("Error in DelayNodeHandler", e);
            result.put("error", "DelayNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
