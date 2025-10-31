package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.workflow.dto.HttpRequestNodeConfigDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.engine.http.HttpHelperUtils;
import vacademy.io.admin_core_service.features.workflow.engine.http.HttpRequestStrategy;
import vacademy.io.admin_core_service.features.workflow.engine.http.HttpRequestStrategyRegistry;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class HttpRequestNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;
    private final HttpHelperUtils httpHelperUtils;
    private final HttpRequestStrategyRegistry strategyRegistry;

    @Override
    public boolean supports(String nodeType) {
        return "HTTP_REQUEST".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson,
                                      Map<String, NodeTemplate> nodeTemplates, int countProcessed) {
        log.info("HttpRequestNodeHandler invoked.");
        Map<String, Object> changes = new HashMap<>();

        HttpRequestNodeConfigDTO dto;
        try {
            dto = objectMapper.readValue(nodeConfigJson, HttpRequestNodeConfigDTO.class);
        } catch (Exception e) {
            log.error("Failed to parse node config JSON into DTO: {}", e.getMessage());
            changes.put("error", "Invalid node config JSON");
            return changes;
        }

        HttpRequestNodeConfigDTO.RequestConfig cfg = dto.getConfig();
        String resultKey = Optional.ofNullable(dto.getResultKey()).orElse("httpResult");
        resultKey = httpHelperUtils.evaluateSpel(resultKey, context, String.class, resultKey);

        try {
            if (StringUtils.hasText(cfg.getCondition())) {
                Boolean conditionResult = httpHelperUtils.evaluateSpel(cfg.getCondition(), context, Boolean.class, false);
                if (conditionResult == null || !conditionResult) {
                    log.info("Condition '{}' evaluated to false or null, skipping execution.", cfg.getCondition());
                    changes.put(resultKey, Map.of("status", "skipped", "condition", cfg.getCondition()));
                    return changes;
                }
                log.info("Condition '{}' evaluated to true.", cfg.getCondition());
            }

            HttpRequestStrategy strategy = strategyRegistry.getStrategy(cfg.getRequestType());
            if (strategy == null) {
                log.error("No HTTP strategy found for requestType: {}", cfg.getRequestType());
                changes.put("error", "No HTTP strategy found for type: " + cfg.getRequestType());
                return changes;
            }

            Map<String, Object> responseResult = strategy.execute(context, cfg);

            changes.put(resultKey, responseResult);

            // Check if the strategy itself returned an error, and if so, log it
            if(responseResult.containsKey("error")) {
                log.error("HttpRequestStrategy execution failed: {}", responseResult.get("error"));
                changes.put("error", responseResult.get("error"));
            } else {
                log.info("HTTP Request Node Success via strategy: {}", cfg.getRequestType());
            }

        } catch (Exception e) {
            log.error("Error executing HttpRequestNodeHandler: {}", e.getMessage(), e);
            changes.put(resultKey, Map.of("status", "error", "message", e.getMessage()));
            changes.put("error", "HttpRequestNodeHandler failed: " + e.getMessage());
        }

        return changes;
    }
}