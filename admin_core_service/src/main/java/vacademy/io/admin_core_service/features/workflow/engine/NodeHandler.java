package vacademy.io.admin_core_service.features.workflow.engine;

import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;

import java.util.Map;

public interface NodeHandler {
    boolean supports(String nodeType);

    Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson, Map<String, NodeTemplate> nodeTemplates,int countProcessed);
}