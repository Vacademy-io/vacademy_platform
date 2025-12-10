package vacademy.io.admin_core_service.features.workflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.engine.NodeHandler;
import vacademy.io.admin_core_service.features.workflow.engine.NodeHandlerRegistry;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;
import vacademy.io.admin_core_service.features.workflow.repository.NodeTemplateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowNodeMappingRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;

import vacademy.io.admin_core_service.features.workflow.entity.WorkflowExecution;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowExecutionStatus;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowExecutionRepository;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowEngineService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowNodeMappingRepository mappingRepository;
    private final NodeTemplateRepository nodeTemplateRepository;
    private final NodeHandlerRegistry nodeHandlerRegistry;
    private final SpelEvaluator spelEvaluator;
    private final ObjectMapper objectMapper;
    private final WorkflowExecutionRepository workflowExecutionRepository;

    public Map<String, Object> run(String workflowId, Map<String, Object> seedContext) {
        try {
            Workflow wf = workflowRepository.findById(workflowId).orElseThrow();
            List<WorkflowNodeMapping> mappings = mappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflowId);

            if (mappings.isEmpty()) {
                log.warn("No node mappings found for workflow: {}", workflowId);
                return seedContext != null ? seedContext : new HashMap<>();
            }

            Map<String, NodeTemplate> templateById = new HashMap<>();
            nodeTemplateRepository.findByInstituteIdAndStatus(wf.getInstituteId(), "ACTIVE")
                    .forEach(t -> templateById.put(t.getId(), t));

            Map<String, Object> ctx = new HashMap<>();
            if (seedContext != null) {
                ctx.putAll(seedContext);
            }
            ctx.put("workflowId", workflowId);
            ctx.put("instituteId", wf.getInstituteId());

            // Create execution record
            WorkflowExecution execution = new WorkflowExecution();
            execution.setWorkflow(wf);
            execution.setIdempotencyKey(UUID.randomUUID().toString());
            execution.setStatus(WorkflowExecutionStatus.PROCESSING);
            execution.setStartedAt(Instant.now());
            execution = workflowExecutionRepository.save(execution);
            String executionId = execution.getId();
            ctx.put("executionId", executionId);

            // Index by node ID for routing convenience
            Map<String, WorkflowNodeMapping> byNodeId = new HashMap<>();
            mappings.forEach(m -> byNodeId.put(m.getNodeTemplateId(), m));

            log.info("=== WORKFLOW NODE MAPPINGS ===");
            for (WorkflowNodeMapping mapping : mappings) {
                log.info("Node ID: {}, Template ID: {}, Order: {}, Is Start: {}",
                        mapping.getId(), mapping.getNodeTemplateId(), mapping.getNodeOrder(), mapping.getIsStartNode());
            }
            log.info("Available node IDs for routing: {}", byNodeId.keySet());
            log.info("=== END WORKFLOW NODE MAPPINGS ===");

            // Find start node
            WorkflowNodeMapping startNode = mappings.stream()
                    .filter(WorkflowNodeMapping::getIsStartNode)
                    .findFirst()
                    .orElse(mappings.get(0)); // Fallback to first node if no start node defined

            // Use Stack for routing calculation instead of relying on node order
            Stack<String> nodeExecutionStack = new Stack<>();
            Set<String> visitedNodes = new HashSet<>();

            // Push start node to stack
            nodeExecutionStack.push(startNode.getNodeTemplateId());
            log.info("Starting workflow execution with start node: {}", startNode.getNodeTemplateId());

            int guard = 0; // prevent infinite loops
            while (!nodeExecutionStack.isEmpty() && guard++ < 500) {
                String currentNodeId = nodeExecutionStack.pop();
                log.info("Processing node ID: {} (stack size: {}, guard: {})", currentNodeId, nodeExecutionStack.size(),
                        guard);

                // Check if we've already visited this node to prevent infinite loops
                if (visitedNodes.contains(currentNodeId)) {
                    log.warn("Node {} already visited, skipping to prevent infinite loop", currentNodeId);
                    continue;
                }

                visitedNodes.add(currentNodeId);

                WorkflowNodeMapping current = byNodeId.get(currentNodeId);
                if (current == null) {
                    log.error("Node mapping not found for node ID: {}", currentNodeId);
                    continue;
                }

                log.info("Processing node: {} (order: {})", current.getId(), current.getNodeOrder());

                NodeTemplate tmpl = templateById.get(current.getNodeTemplateId());
                if (tmpl == null) {
                    log.error("Node template not found for mapping: {}", current.getId());
                    continue;
                }

                String effectiveConfig = mergeConfig(tmpl.getConfigJson(), current.getOverrideConfig());
                String nodeType = tmpl.getNodeType();
                log.info("Node type: {}, effective config: {}", nodeType, effectiveConfig);
                ctx.put("currentNodeId", currentNodeId);
                // Use registry for O(1) lookup
                NodeHandler handler = nodeHandlerRegistry.getHandler(nodeType);
                if (handler != null) {
                    try {
                        log.info("Executing handler: {} for node: {}", handler.getClass().getSimpleName(),
                                current.getId());
                        Map<String, Object> changes = handler.handle(ctx, effectiveConfig, templateById, guard);
                        if (changes != null && !changes.isEmpty()) {
                            ctx.putAll(changes);
                            log.info("Node {} updated context with: {}", current.getId(), changes.keySet());
                        }
                    } catch (Exception e) {
                        log.error("Error executing node: {}", current.getId(), e);
                        // Continue with next node instead of breaking
                    }
                } else {
                    log.warn("No handler found for node type: {}", nodeType);
                }

                // Evaluate routing to find next nodes and push them to stack
                List<String> nextNodeIds = evaluateRoutingNextNodeIds(effectiveConfig, ctx);
                log.info("Routing evaluation for node {} returned: {}", current.getId(), nextNodeIds);

                if (nextNodeIds == null || nextNodeIds.isEmpty()) {
                    log.info("Path execution completed at node: {}", current.getId());
                    continue;
                }

                // Push next nodes to stack in reverse order so they execute in correct order
                // (Stack is LIFO, so we push in reverse to maintain execution order)
                // IMPORTANT: Process ALL routing rules to enable multi-path execution
                for (int i = nextNodeIds.size() - 1; i >= 0; i--) {
                    String nextNodeId = nextNodeIds.get(i);
                    if (nextNodeId != null && !"end".equalsIgnoreCase(nextNodeId)) {
                        // Check if the next node exists in the workflow
                        if (byNodeId.containsKey(nextNodeId)) {
                            nodeExecutionStack.push(nextNodeId);
                            log.info("Pushed next node {} to execution stack (route {})", nextNodeId, i);
                        } else {
                            log.error("Next node {} not found in workflow! Available nodes: {}", nextNodeId,
                                    byNodeId.keySet());
                        }
                    }
                }

                // If we have multiple routes, we want to execute them all
                // This enables scenarios like: SendWhatsApp -> SendEmail (both execute)
                if (nextNodeIds.size() > 1) {
                    log.info("Multiple routes detected ({}), all will be executed sequentially", nextNodeIds.size());
                }
            }

            if (guard >= 500) {
                log.warn("Workflow execution stopped due to loop guard limit: {}", workflowId);
                execution.setStatus(WorkflowExecutionStatus.FAILED);
            } else {
                execution.setStatus(WorkflowExecutionStatus.COMPLETED);
            }
            execution.setCompletedAt(Instant.now());
            workflowExecutionRepository.save(execution);

            return ctx;

        } catch (Exception e) {
            log.error("Error executing workflow: {}", workflowId, e);
            return seedContext != null ? seedContext : new HashMap<>();
        }
    }

    private String mergeConfig(String baseJson, String overrideJson) {
        try {
            if (overrideJson == null || overrideJson.isBlank()) {
                return baseJson;
            }
            JsonNode base = objectMapper.readTree(baseJson);
            JsonNode over = objectMapper.readTree(overrideJson);
            JsonNode merged = deepMerge(base, over);
            return objectMapper.writeValueAsString(merged);
        } catch (Exception e) {
            log.error("Error merging configs", e);
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

    private List<String> evaluateRoutingNextNodeIds(String configJson, Map<String, Object> ctx) {
        try {
            JsonNode root = objectMapper.readTree(configJson);
            JsonNode routing = root.path("routing");

            log.info("=== ROUTING EVALUATION START ===");
            log.info("Evaluating routing for config: {}", configJson);
            log.info("Routing node: {}", routing);
            log.info("Context keys: {}", ctx.keySet());

            if (routing.isMissingNode() || !routing.isArray()) {
                log.info("No routing found or routing is not an array - routing.isMissingNode: {}, routing.isArray: {}",
                        routing.isMissingNode(), routing.isArray());
                return Collections.emptyList();
            }

            List<String> allNextNodeIds = new ArrayList<>();

            for (int i = 0; i < routing.size(); i++) {
                JsonNode route = routing.get(i);
                String type = route.path("type").asText("");
                String operation = route.path("operation").asText("");
                String nextNodeId = null;

                log.info("Processing route {} - type: '{}', operation: '{}', route: {}", i, type, operation, route);

                if ("end".equalsIgnoreCase(type)) {
                    log.info("Found end route");
                    // We don't return immediately, in case there are other parallel routes.
                    // An "end" route simply means this path terminates.
                } else if ("goto".equalsIgnoreCase(type)) {
                    nextNodeId = route.path("targetNodeId").asText(null);
                    if (nextNodeId != null) {
                        allNextNodeIds.add(nextNodeId);
                        log.info("Added goto route to nextNodeId: {}", nextNodeId);
                    } else {
                        log.warn("Goto route missing targetNodeId: {}", route);
                    }
                } else if ("conditional".equalsIgnoreCase(type)) {
                    String cond = route.path("condition").asText("");
                    Object val = spelEvaluator.evaluate(cond, ctx);
                    boolean b = (val instanceof Boolean bo) ? bo : Boolean.parseBoolean(String.valueOf(val));
                    nextNodeId = b ? route.path("trueNodeId").asText(null) : route.path("falseNodeId").asText(null);
                    if (nextNodeId != null) {
                        allNextNodeIds.add(nextNodeId);
                        log.info("Added conditional route to nextNodeId: {} (condition: {} = {})", nextNodeId, cond, b);
                    } else {
                        log.warn("Conditional route missing targetNodeId: {}", route);
                    }
                } else if ("switch".equalsIgnoreCase(type)) {
                    // Handle old switch format
                    nextNodeId = evaluateSwitchRouting(route, ctx);
                    if (nextNodeId != null) {
                        allNextNodeIds.add(nextNodeId);
                        log.info("Added switch route to nextNodeId: {}", nextNodeId);
                    } else {
                        log.warn("Switch route evaluation returned null: {}", route);
                    }
                } else if ("SWITCH".equalsIgnoreCase(operation)) {
                    // Handle new SWITCH operation format
                    nextNodeId = evaluateSwitchOperationRouting(route, ctx);
                    if (nextNodeId != null) {
                        allNextNodeIds.add(nextNodeId);
                        log.info("Added SWITCH operation route to nextNodeId: {}", nextNodeId);
                    } else {
                        log.warn("SWITCH operation route evaluation returned null: {}", route);
                    }
                } else {
                    log.warn("Unknown route type/operation: type='{}', operation='{}'", type, operation);
                }
            }

            log.info("Final nextNodeIds: {}", allNextNodeIds);
            log.info("=== ROUTING EVALUATION END ===");
            return allNextNodeIds;

        } catch (Exception e) {
            log.error("Error evaluating routing", e);
            return Collections.emptyList();
        }
    }

    /**
     * Evaluate switch routing for old format (type: "switch")
     */
    private String evaluateSwitchRouting(JsonNode route, Map<String, Object> ctx) {
        String expr = route.path("expression").asText("");
        Object key = spelEvaluator.evaluate(expr, ctx);
        for (JsonNode c : route.path("cases")) {
            if (Objects.equals(String.valueOf(key), c.path("value").asText())) {
                String nextNodeId = c.path("targetNodeId").asText(null);
                if (nextNodeId != null) {
                    return nextNodeId;
                }
            }
        }
        String nextNodeId = route.path("defaultNodeId").asText(null);
        return nextNodeId;
    }

    /**
     * Evaluate switch operation routing for new format (operation: "SWITCH")
     */
    private String evaluateSwitchOperationRouting(JsonNode route, Map<String, Object> ctx) {
        String onExpr = route.path("on").asText("");
        if (onExpr.isBlank()) {
            log.warn("SWITCH operation missing 'on' expression");
            return null;
        }

        // Evaluate the switch expression
        Object switchValue = spelEvaluator.evaluate(onExpr, ctx);
        String key = String.valueOf(switchValue);
        log.info("SWITCH operation evaluating '{}' to key: '{}'", onExpr, key);

        // Find matching case
        JsonNode cases = route.path("cases");
        log.info("SWITCH cases: {}", cases);

        if (cases.isObject()) {
            JsonNode selectedCase = cases.get(key);
            log.info("SWITCH selected case for key '{}': {}", key, selectedCase);

            if (selectedCase != null) {
                // Handle nested structure: {"type": "goto", "targetNodeId": "node_id"}
                if (selectedCase.has("type") && selectedCase.has("targetNodeId")) {
                    String caseType = selectedCase.path("type").asText("");
                    String nextNodeId = selectedCase.path("targetNodeId").asText(null);

                    log.info("SWITCH case has nested structure - type: '{}', targetNodeId: '{}'", caseType, nextNodeId);

                    if ("goto".equalsIgnoreCase(caseType) && nextNodeId != null) {
                        log.info("SWITCH operation found matching case for key '{}': {} (nested format)", key,
                                nextNodeId);
                        return nextNodeId;
                    } else {
                        log.warn(
                                "SWITCH operation case has invalid type or missing targetNodeId: type='{}', targetNodeId='{}'",
                                caseType, nextNodeId);
                    }
                } else {
                    // Handle direct targetNodeId (old format)
                    String nextNodeId = selectedCase.path("targetNodeId").asText(null);
                    log.info("SWITCH case has direct format - targetNodeId: '{}'", nextNodeId);

                    if (nextNodeId != null) {
                        log.info("SWITCH operation found matching case for key '{}': {} (direct format)", key,
                                nextNodeId);
                        return nextNodeId;
                    }
                }
            } else {
                log.warn("SWITCH operation no case found for key: '{}'", key);
            }
        } else {
            log.warn("SWITCH operation cases is not an object: {}", cases);
        }

        // Check for default case
        JsonNode defaultCase = route.path("default");
        log.info("SWITCH default case: {}", defaultCase);

        if (!defaultCase.isMissingNode()) {
            // Handle nested structure for default case too
            if (defaultCase.has("type") && defaultCase.has("targetNodeId")) {
                String caseType = defaultCase.path("type").asText("");
                String nextNodeId = defaultCase.path("targetNodeId").asText(null);

                log.info("SWITCH default case has nested structure - type: '{}', targetNodeId: '{}'", caseType,
                        nextNodeId);

                if ("goto".equalsIgnoreCase(caseType) && nextNodeId != null) {
                    log.info("SWITCH operation using default case: {} (nested format)", nextNodeId);
                    return nextNodeId;
                }
            } else {
                // Handle direct targetNodeId for default case
                String nextNodeId = defaultCase.path("targetNodeId").asText(null);
                log.info("SWITCH default case has direct format - targetNodeId: '{}'", nextNodeId);

                if (nextNodeId != null) {
                    log.info("SWITCH operation using default case: {} (direct format)", nextNodeId);
                    return nextNodeId;
                }
            }
        }

        log.warn("SWITCH operation no matching case found for key: '{}' and no valid default case", key);
        return null;
    }
}