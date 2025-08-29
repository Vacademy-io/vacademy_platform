package vacademy.io.admin_core_service.features.workflow.engine.action;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class DataProcessorStrategyRegistry {

    @Autowired
    private List<DataProcessorStrategy> strategies;

    private final Map<String, DataProcessorStrategy> strategyMap = new HashMap<>();

    @PostConstruct
    public void init() {
        for (DataProcessorStrategy strategy : strategies) {
            strategyMap.put(strategy.getOperationType().toUpperCase(), strategy);
            log.info("Registered data processor strategy: {}", strategy.getOperationType());
        }
    }

    public DataProcessorStrategy getStrategy(String operation) {
        return strategyMap.get(operation.toUpperCase());
    }

    public boolean hasStrategy(String operation) {
        return strategyMap.containsKey(operation.toUpperCase());
    }
}