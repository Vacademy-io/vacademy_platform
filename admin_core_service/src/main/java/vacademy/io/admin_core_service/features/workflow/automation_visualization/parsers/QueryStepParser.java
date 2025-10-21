package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.util.Map;

@Component
public class QueryStepParser implements StepParser {

    @Override
    public boolean canParse(Map<String, Object> nodeData) {
        return nodeData.containsKey("prebuiltKey");
    }

    @Override
    public AutomationDiagramDTO.Node parse(String nodeId, Map<String, Object> nodeData) {
        String key = (String) nodeData.get("prebuiltKey");
        String title = AutomationParserService.TERMINOLOGY_MAP.getOrDefault(key, AutomationParserService.humanizeIdentifier(key));

        return AutomationDiagramDTO.Node.builder()
                .id(nodeId)
                .title(title)
                .description("Performs a database query to fetch information.")
                .type("ACTION")
                .details(AutomationParserService.cleanSpelExpressions(Map.of("Parameters", nodeData.get("params"))))
                .build();
    }
}