package vacademy.io.admin_core_service.features.workflow.actions;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public interface ActionHandlerService {
    String getType();

    Map<String, Object> execute(Map<String, Object> item, JsonNode config, Map<String, Object> context);
}