package vacademy.io.admin_core_service.features.workflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.engine.NodeHandler;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;
import vacademy.io.admin_core_service.features.workflow.repository.NodeTemplateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowNodeMappingRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import java.util.*;

@Service
@RequiredArgsConstructor
public class WorkflowEngineService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowNodeMappingRepository mappingRepository;
    private final NodeTemplateRepository nodeTemplateRepository;
    private final List<NodeHandler> nodeHandlers;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;

    public Map<String, Object> run(String workflowId, String scheduleRunId, Map<String, Object> seedContext) {
        Workflow wf = workflowRepository.findById(workflowId).orElseThrow();
        List<WorkflowNodeMapping> mappings = mappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflowId);
        Map<String, NodeTemplate> templateById = new HashMap<>();
        nodeTemplateRepository.findByInstituteIdAndStatus(wf.getInstituteId(), "ACTIVE")
                .forEach(t -> templateById.put(t.getId(), t));

        Map<String, Object> ctx = new HashMap<>();
        if (seedContext != null)
            ctx.putAll(seedContext);
        ctx.put("workflow_id", workflowId);
        ctx.put("schedule_run_id", scheduleRunId);
        ctx.put("institute_id", wf.getInstituteId());

        // index by name for routing convenience
        Map<String, WorkflowNodeMapping> byName = new HashMap<>();
        Map<String, String> nameToTemplateId = new HashMap<>();
        mappings.forEach(m -> {
            NodeTemplate t = templateById.get(m.getNodeTemplateId());
            if (t != null) {
                byName.put(t.getNodeName(), m);
                nameToTemplateId.put(t.getNodeName(), t.getId());
            }
        });

        // find start
        WorkflowNodeMapping current = mappings.stream().filter(WorkflowNodeMapping::getIsStartNode).findFirst()
                .orElse(mappings.isEmpty() ? null : mappings.get(0));
        int guard = 0; // prevent infinite loops
        while (current != null && guard++ < 500) {
            NodeTemplate tmpl = templateById.get(current.getNodeTemplateId());
            if (tmpl == null)
                break;
            String effectiveConfig = mergeConfig(tmpl.getConfigJson(), current.getOverrideConfig());
            String nodeType = tmpl.getNodeType();

            NodeHandler handler = nodeHandlers.stream().filter(h -> h.supports(nodeType)).findFirst().orElse(null);
            if (handler != null) {
                Map<String, Object> changes = handler.handle(ctx, effectiveConfig);
                if (changes != null)
                    ctx.putAll(changes);
            }

            // routing
            String nextName = evaluateRoutingNextName(effectiveConfig, ctx);
            if (nextName == null)
                break;
            if ("end".equalsIgnoreCase(nextName))
                break;
            WorkflowNodeMapping next = byName.get(nextName);
            current = next;
        }
        return ctx;
    }

    private String mergeConfig(String baseJson, String overrideJson) {
        try {
            if (overrideJson == null || overrideJson.isBlank())
                return baseJson;
            JsonNode base = objectMapper.readTree(baseJson);
            JsonNode over = objectMapper.readTree(overrideJson);
            JsonNode merged = deepMerge(base, over);
            return objectMapper.writeValueAsString(merged);
        } catch (Exception e) {
            return baseJson;
        }
    }

    private JsonNode deepMerge(JsonNode base, JsonNode over) {
        if (base.isObject() && over.isObject()) {
            Iterator<String> it = over.fieldNames();
            while (it.hasNext()) {
                String f = it.next();
                JsonNode bv = base.get(f);
                JsonNode ov = over.get(f);
                if (bv != null && bv.isObject() && ov.isObject()) {
                    deepMerge(bv, ov);
                } else if (base instanceof com.fasterxml.jackson.databind.node.ObjectNode on) {
                    on.set(f, ov);
                }
            }
        }
        return base;
    }

    private String evaluateRoutingNextName(String configJson, Map<String, Object> ctx) {
        try {
            JsonNode root = objectMapper.readTree(configJson);
            JsonNode routing = root.path("routing");
            String type = routing.path("type").asText("");
            if ("end".equalsIgnoreCase(type))
                return "end";
            if ("goto".equalsIgnoreCase(type))
                return routing.path("target_node").asText(null);
            if ("conditional".equalsIgnoreCase(type)) {
                String cond = routing.path("condition").asText("");
                Object val = spelEvaluator.eval(cond, ctx);
                boolean b = (val instanceof Boolean bo) ? bo : Boolean.parseBoolean(String.valueOf(val));
                return b ? routing.path("true_node").asText(null) : routing.path("false_node").asText(null);
            }
            if ("switch".equalsIgnoreCase(type)) {
                String expr = routing.path("expression").asText("");
                Object key = spelEvaluator.eval(expr, ctx);
                for (JsonNode c : routing.path("cases")) {
                    if (Objects.equals(String.valueOf(key), c.path("value").asText())) {
                        return c.path("target_node").asText(null);
                    }
                }
                return routing.path("default_node").asText(null);
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}