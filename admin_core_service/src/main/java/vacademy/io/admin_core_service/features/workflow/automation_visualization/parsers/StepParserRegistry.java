package vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers;

import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class StepParserRegistry {

    private final List<StepParser> parsers;

    public StepParserRegistry(List<StepParser> parsers) {
        this.parsers = parsers;
    }

    public Optional<StepParser> getParser(Map<String, Object> nodeData) {
        return parsers.stream()
                .filter(p -> p.canParse(nodeData))
                .findFirst();
    }
}