package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class DelayNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
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

            long delayMs = switch (unit) {
                case "MINUTES" -> TimeUnit.MINUTES.toMillis(value);
                case "HOURS" -> TimeUnit.HOURS.toMillis(value);
                default -> TimeUnit.SECONDS.toMillis(value);
            };

            Boolean dryRun = (Boolean) context.getOrDefault("dryRun", false);
            if (Boolean.TRUE.equals(dryRun)) {
                log.info("[DRY RUN] DELAY node - would wait {} {} ({} ms)", value, unit, delayMs);
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
                log.info("DELAY node: waiting {} {} ({} ms) inline", value, unit, delayMs);
                Thread.sleep(delayMs);
                result.put("delayed", true);
                result.put("delayMs", delayMs);
            } else {
                // For longer delays, log a warning - full persistent delay support requires Phase 5
                log.warn("DELAY node: {} {} ({} ms) exceeds inline limit ({}ms). Executing immediately - persistent delay requires workflow_execution_state table.",
                        value, unit, delayMs, MAX_INLINE_DELAY_MS);
                result.put("delayed", false);
                result.put("delayMs", delayMs);
                result.put("warning", "Long delay executed immediately. Persistent delay support coming in future update.");
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
