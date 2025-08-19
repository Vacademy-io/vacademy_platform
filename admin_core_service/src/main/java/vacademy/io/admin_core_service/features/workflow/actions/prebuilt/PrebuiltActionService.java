package vacademy.io.admin_core_service.features.workflow.actions.prebuilt;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

public interface PrebuiltActionService {
    String key();

    Map<String, Object> execute(JsonNode config, Map<String, Object> context);
}