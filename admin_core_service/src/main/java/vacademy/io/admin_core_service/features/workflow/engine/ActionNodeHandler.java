package vacademy.io.admin_core_service.features.workflow.engine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.actions.ActionHandlerService;
import vacademy.io.admin_core_service.features.workflow.actions.prebuilt.PrebuiltActionService;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Component
@RequiredArgsConstructor
public class ActionNodeHandler implements NodeHandler {
    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final DedupeService dedupeService;
    private final ApplicationContext applicationContext;
    private final List<PrebuiltActionService> prebuiltServices;

    @Override
    public boolean supports(String nodeType) {
        return "ACTION".equalsIgnoreCase(nodeType);
    }

    @Override
    public Map<String, Object> handle(Map<String, Object> context, String nodeConfigJson) {
        Map<String, Object> changes = new HashMap<>();
        try {
            JsonNode root = objectMapper.readTree(nodeConfigJson);
            JsonNode actions = root.path("actions");
            if (actions.isArray()) {
                for (JsonNode action : actions) {
                    String type = action.path("type").asText("");
                    String overInput = action.path("iterate").path("over_input").asText("items");
                    String appendTo = action.path("outputs").path("append_to").asText("action_results");

                    // Prebuilt action dispatch (no iteration over_input required)
                    String prebuiltKey = action.path("config").path("prebuilt_key").asText("");
                    if (!prebuiltKey.isBlank()) {
                        PrebuiltActionService svc = prebuiltServices.stream()
                                .filter(s -> s.key().equals(prebuiltKey)).findFirst().orElse(null);
                        if (svc != null) {
                            Map<String, Object> res = svc.execute(action.path("config"), context);
                            List<Map<String, Object>> existing = castListOfMap(
                                    context.getOrDefault(appendTo, new ArrayList<>()));
                            existing.add(res);
                            changes.put(appendTo, existing);
                        }
                        continue;
                    }

                    List<Map<String, Object>> items = castListOfMap(
                            context.getOrDefault(overInput, Collections.emptyList()));
                    ActionHandlerService handler = applicationContext.getBeansOfType(ActionHandlerService.class)
                            .values().stream().filter(h -> h.getType().equalsIgnoreCase(type)).findFirst()
                            .orElse(null);
                    if (handler == null)
                        continue;

                    List<Map<String, Object>> results = new ArrayList<>();
                    for (Map<String, Object> item : items) {
                        Map<String, Object> vars = new HashMap<>(context);
                        vars.put("item", item);
                        String dedupeKeyExpr = action.path("idempotency").path("key").asText(null);
                        String dedupeKey = dedupeKeyExpr == null ? null
                                : String.valueOf(spelEvaluator.eval(dedupeKeyExpr, vars));
                        if (dedupeKey != null && dedupeService.seen(dedupeKey))
                            continue;

                        Map<String, Object> res = handler.execute(item, action.path("config"), context);
                        if (dedupeKey != null && Boolean.TRUE.equals(res.get("success")))
                            dedupeService.remember(dedupeKey);
                        results.add(res);
                    }

                    List<Map<String, Object>> existing = castListOfMap(
                            context.getOrDefault(appendTo, new ArrayList<>()));
                    existing.addAll(results);
                    changes.put(appendTo, existing);
                }
            }
        } catch (Exception e) {
            changes.put("action_error", e.getMessage());
        }
        return changes;
    }

    private List<Map<String, Object>> castListOfMap(Object o) {
        if (o instanceof List<?> l) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (Object e : l)
                if (e instanceof Map<?, ?> m)
                    out.add((Map<String, Object>) m);
                else if (e != null)
                    out.add(Map.of("value", e));
            return out;
        }
        return new ArrayList<>();
    }

    public interface DedupeService {
        boolean seen(String key);

        void remember(String key);
    }
}
