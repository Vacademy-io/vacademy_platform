package vacademy.io.admin_core_service.features.workflow.engine.http;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
public class HttpRequestStrategyRegistry {

    private final List<HttpRequestStrategy> strategies;
    private final Map<String, HttpRequestStrategy> strategyMap = new HashMap<>();

    public HttpRequestStrategyRegistry(List<HttpRequestStrategy> strategies) {
        this.strategies = strategies;
    }

    @PostConstruct
    public void init() {
        if (strategies == null) {
            log.error("HttpRequestStrategy list is null.");
            return;
        }
        for (HttpRequestStrategy strategy : strategies) {
            if (strategy.canHandle("EXTERNAL")) {
                strategyMap.put("EXTERNAL", strategy);
                log.info("Registered HttpRequestStrategy: EXTERNAL");
            } else if (strategy.canHandle("INTERNAL")) {
                strategyMap.put("INTERNAL", strategy);
                log.info("Registered HttpRequestStrategy: INTERNAL");
            }
        }
    }

    public HttpRequestStrategy getStrategy(String requestType) {
        return strategyMap.get(Optional.ofNullable(requestType).orElse("EXTERNAL").toUpperCase());
    }
}