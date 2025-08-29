package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.QueryNodeDTO;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QueryNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final QueryService queryService;

    @Override
    public boolean supports(String nodeType) {
        return "QUERY".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context,
            String nodeConfigJson,
            Map<String, NodeTemplate> nodeTemplates,
            int countProcessed) {
        log.info("QueryNodeHandler.handle() invoked with context: {}, configJson: {}", context, nodeConfigJson);

        Map<String, Object> changes = new HashMap<>();

        try {
            // Deserialize JSON into DTO
            QueryNodeDTO config = objectMapper.readValue(nodeConfigJson, QueryNodeDTO.class);

            String prebuiltKey = config.getPrebuiltKey();
            Map<String, Object> rawParams = config.getParams();

            if (prebuiltKey != null && !prebuiltKey.isBlank()) {
                Map<String, Object> queryParams = new HashMap<>();

                if (rawParams != null) {
                    for (Map.Entry<String, Object> entry : rawParams.entrySet()) {
                        String key = entry.getKey();
                        Object valueExpr = entry.getValue();

                        Object value;
                        if (valueExpr instanceof String) {
                            value = spelEvaluator.eval((String) valueExpr, context);
                        } else {
                            value = valueExpr;
                        }
                        queryParams.put(key, value);
                    }
                }

                log.debug("Executing query with key: {}, params: {}", prebuiltKey, queryParams);
                Map<String, Object> queryResult = queryService.execute(prebuiltKey, queryParams);
                if (queryResult != null) {
                    changes.putAll(queryResult);
                }
            }

        } catch (Exception e) {
            log.error("Error while processing QueryNodeHandler config", e);
            changes.put("error", e.getMessage());
        }

        log.info("Query changes map prepared: {}", changes);
        return changes;
    }

    public interface QueryService {
        Map<String, Object> execute(String prebuiltKey, Map<String, Object> params);
    }
}