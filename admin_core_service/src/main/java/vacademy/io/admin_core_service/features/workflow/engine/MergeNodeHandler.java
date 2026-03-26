package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class MergeNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;

    @Override
    public boolean supports(String nodeType) {
        return "MERGE".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
                                       String nodeConfigJson,
                                       Map<String, NodeTemplate> nodeTemplates,
                                       int countProcessed) {
        Map<String, Object> result = new HashMap<>();
        try {
            JsonNode config = objectMapper.readTree(nodeConfigJson);
            JsonNode waitForNode = config.path("waitFor");
            String strategy = config.path("strategy").asText("ALL");

            if (!waitForNode.isArray() || waitForNode.isEmpty()) {
                // No explicit waitFor — pass-through merge point
                log.info("MERGE node: no waitFor specified, acting as pass-through");
                result.put("merged", true);
                result.put("strategy", strategy);
                return result;
            }

            // Check if expected upstream data is present in context
            List<String> waitForIds = new ArrayList<>();
            for (JsonNode id : waitForNode) {
                waitForIds.add(id.asText());
            }

            List<String> missing = new ArrayList<>();
            List<String> present = new ArrayList<>();

            for (String nodeId : waitForIds) {
                // Check if the node's output exists in context (convention: nodeId_output)
                String outputKey = nodeId + "_output";
                if (context.containsKey(outputKey) || context.containsKey(nodeId)) {
                    present.add(nodeId);
                } else {
                    missing.add(nodeId);
                }
            }

            boolean merged;
            if ("ALL".equalsIgnoreCase(strategy)) {
                merged = missing.isEmpty();
                if (!merged) {
                    log.warn("MERGE node (ALL strategy): missing data from nodes: {}", missing);
                }
            } else { // ANY
                merged = !present.isEmpty();
                if (!merged) {
                    log.warn("MERGE node (ANY strategy): no data from any upstream node");
                }
            }

            result.put("merged", merged);
            result.put("strategy", strategy);
            result.put("presentNodes", present);
            result.put("missingNodes", missing);

            if (!merged) {
                result.put("warning", "Merge condition not fully met. Missing: " + missing);
            }

            log.info("MERGE node: strategy={}, present={}, missing={}, merged={}", strategy, present.size(), missing.size(), merged);

        } catch (Exception e) {
            log.error("Error in MergeNodeHandler", e);
            result.put("error", "MergeNodeHandler error: " + e.getMessage());
        }
        return result;
    }
}
