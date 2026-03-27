package vacademy.io.notification_service.features.chatbot_flow.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlow;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowEdge;
import vacademy.io.notification_service.features.chatbot_flow.entity.ChatbotFlowNode;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowEdgeRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowNodeRepository;
import vacademy.io.notification_service.features.chatbot_flow.repository.ChatbotFlowRepository;
import vacademy.io.notification_service.features.combot.entity.ChannelFlowConfig;
import vacademy.io.notification_service.features.combot.repository.ChannelFlowConfigRepository;

import java.util.*;

/**
 * One-time migration service: converts ChannelFlowConfig rows into chatbot_flow graph format.
 *
 * Each old row becomes one flow:
 * - TRIGGER node (matches all keywords from response_template_config)
 * - CONDITION node (branches by keyword)
 * - SEND_TEMPLATE nodes (one per response template)
 * - WORKFLOW_ACTION nodes (from action_template_config rules)
 *
 * Layout: vertical tree, TRIGGER at top, CONDITION below, branches spread horizontally.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ChatbotFlowMigrationService {

    private final ChannelFlowConfigRepository legacyRepository;
    private final ChatbotFlowRepository flowRepository;
    private final ChatbotFlowNodeRepository nodeRepository;
    private final ChatbotFlowEdgeRepository edgeRepository;
    private final ObjectMapper objectMapper;

    /**
     * Migrate all active ChannelFlowConfig rows to chatbot_flow format.
     * Returns count of flows created. Safe to run multiple times — skips already-migrated rows.
     */
    @Transactional
    public MigrationResult migrateAll() {
        List<ChannelFlowConfig> legacyConfigs = legacyRepository.findAll();
        int created = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        for (ChannelFlowConfig config : legacyConfigs) {
            try {
                // Check if already migrated (flow name contains legacy ID)
                String migrationTag = "legacy:" + config.getId();
                List<ChatbotFlow> existing = flowRepository.findByInstituteIdOrderByUpdatedAtDesc(config.getInstituteId());
                boolean alreadyMigrated = existing.stream()
                        .anyMatch(f -> f.getDescription() != null && f.getDescription().contains(migrationTag));

                if (alreadyMigrated) {
                    skipped++;
                    continue;
                }

                migrateOne(config);
                created++;
                log.info("Migrated ChannelFlowConfig: id={}, template={}", config.getId(), config.getCurrentTemplateName());

            } catch (Exception e) {
                String msg = "Failed to migrate " + config.getId() + ": " + e.getMessage();
                errors.add(msg);
                log.error(msg, e);
            }
        }

        log.info("Migration complete: created={}, skipped={}, errors={}", created, skipped, errors.size());
        return new MigrationResult(created, skipped, errors);
    }

    private void migrateOne(ChannelFlowConfig config) {
        String instituteId = config.getInstituteId();
        String channelType = config.getChannelType();
        String currentTemplate = config.getCurrentTemplateName();

        // Parse JSON configs
        Map<String, List<String>> responseConfig = parseResponseConfig(config.getResponseTemplateConfig());
        Map<String, List<String>> variableConfig = parseResponseConfig(config.getVariableConfig());
        Map<String, Map<String, String>> fixedVarsConfig = parseFixedVarsConfig(config.getFixedVariablesConfig());
        Map<String, Object> actionConfig = parseJsonObject(config.getActionTemplateConfig());

        // Collect all keywords for trigger
        Set<String> allKeywords = new LinkedHashSet<>(responseConfig.keySet());
        allKeywords.remove("default");

        boolean hasResponseBranches = !responseConfig.isEmpty() && responseConfig.values().stream().anyMatch(v -> !v.isEmpty());
        boolean hasActionRules = actionConfig != null && actionConfig.containsKey("rules");

        // Create the flow
        String flowName = "Reply to: " + currentTemplate;
        ChatbotFlow flow = ChatbotFlow.builder()
                .instituteId(instituteId)
                .name(flowName)
                .description("Migrated from legacy ChannelFlowConfig. legacy:" + config.getId())
                .channelType(channelType)
                .status("DRAFT") // Migrated as DRAFT — admin activates after review
                .version(1)
                .createdBy("migration")
                .build();
        flow = flowRepository.save(flow);
        String flowId = flow.getId();

        double yPos = 50;
        double xCenter = 400;

        // ===== 1. TRIGGER NODE =====
        // Old system triggers on "last sent template = X" then matches keywords.
        // New system: TRIGGER on keyword match (the keywords from response_template_config)
        Map<String, Object> triggerConfig = new LinkedHashMap<>();
        triggerConfig.put("triggerType", "KEYWORD_MATCH");
        triggerConfig.put("keywords", new ArrayList<>(allKeywords));
        triggerConfig.put("matchType", "exact");
        triggerConfig.put("_legacyCurrentTemplate", currentTemplate); // For reference

        ChatbotFlowNode triggerNode = saveNode(flowId, "TRIGGER", "When user replies to " + currentTemplate,
                triggerConfig, xCenter, yPos);
        yPos += 150;

        // ===== 2. ACTION RULES (WORKFLOW_ACTION nodes) =====
        if (hasActionRules) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rules = (List<Map<String, Object>>) actionConfig.get("rules");
            if (rules != null) {
                for (int i = 0; i < rules.size(); i++) {
                    Map<String, Object> rule = rules.get(i);
                    String trigger = (String) rule.getOrDefault("trigger", "");
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> actions = (List<Map<String, Object>>) rule.get("actions");

                    if (actions != null) {
                        for (Map<String, Object> action : actions) {
                            String type = (String) action.getOrDefault("type", "");
                            if ("WORKFLOW".equals(type)) {
                                Map<String, Object> nodeConfig = new LinkedHashMap<>();
                                nodeConfig.put("workflowId", action.get("workflowId"));
                                nodeConfig.put("_legacyTrigger", trigger);
                                nodeConfig.put("_legacyMatchType", rule.get("match_type"));

                                ChatbotFlowNode wfNode = saveNode(flowId, "WORKFLOW_ACTION",
                                        "Workflow: " + trigger, nodeConfig, xCenter + (i * 250), yPos);

                                // Edge from trigger to workflow (labeled with trigger keyword)
                                saveEdge(flowId, triggerNode.getId(), wfNode.getId(), trigger, Map.of(
                                        "branchId", "action_" + trigger,
                                        "matchType", rule.getOrDefault("match_type", "exact"),
                                        "matchValue", trigger
                                ));
                            }
                        }
                    }
                }
                yPos += 150;
            }
        }

        // ===== 3. CONDITION NODE (if multiple response branches) =====
        if (hasResponseBranches && responseConfig.size() > 1) {
            // Build branches
            List<Map<String, Object>> branches = new ArrayList<>();
            int branchIdx = 0;
            for (Map.Entry<String, List<String>> entry : responseConfig.entrySet()) {
                String keyword = entry.getKey();
                if (entry.getValue().isEmpty()) continue;

                Map<String, Object> branch = new LinkedHashMap<>();
                branch.put("id", "branch_" + branchIdx);
                branch.put("label", keyword);
                if ("default".equals(keyword)) {
                    branch.put("isDefault", true);
                    branch.put("matchType", "contains");
                    branch.put("matchValue", "");
                } else {
                    branch.put("isDefault", false);
                    branch.put("matchType", "exact");
                    branch.put("matchValue", keyword);
                }
                branches.add(branch);
                branchIdx++;
            }

            Map<String, Object> conditionConfig = new LinkedHashMap<>();
            conditionConfig.put("conditionType", "USER_RESPONSE");
            conditionConfig.put("branches", branches);

            ChatbotFlowNode conditionNode = saveNode(flowId, "CONDITION", "Match reply",
                    conditionConfig, xCenter, yPos);

            // Edge: TRIGGER → CONDITION
            saveEdge(flowId, triggerNode.getId(), conditionNode.getId(), null, null);
            yPos += 150;

            // ===== 4. SEND_TEMPLATE nodes per branch =====
            int xOffset = 0;
            branchIdx = 0;
            for (Map.Entry<String, List<String>> entry : responseConfig.entrySet()) {
                String keyword = entry.getKey();
                List<String> templates = entry.getValue();
                if (templates.isEmpty()) {
                    branchIdx++;
                    continue;
                }

                // Chain templates: CONDITION → SEND_TEMPLATE_1 → SEND_TEMPLATE_2
                String prevNodeId = conditionNode.getId();
                boolean isFirstInBranch = true;

                for (String templateName : templates) {
                    Map<String, Object> templateConfig = buildTemplateConfig(templateName, variableConfig, fixedVarsConfig);

                    double xPos = xCenter - 300 + (xOffset * 300);
                    ChatbotFlowNode sendNode = saveNode(flowId, "SEND_TEMPLATE",
                            "Send: " + templateName, templateConfig, xPos, yPos + (isFirstInBranch ? 0 : 120));

                    if (isFirstInBranch) {
                        // Edge from CONDITION with branch label
                        saveEdge(flowId, prevNodeId, sendNode.getId(), keyword, Map.of(
                                "branchId", "branch_" + branchIdx
                        ));
                    } else {
                        // Chain: previous template → next template
                        saveEdge(flowId, prevNodeId, sendNode.getId(), null, null);
                    }

                    prevNodeId = sendNode.getId();
                    isFirstInBranch = false;
                }
                xOffset++;
                branchIdx++;
            }

        } else if (hasResponseBranches) {
            // Single keyword → template(s), no condition needed
            // TRIGGER → SEND_TEMPLATE(s) directly
            String prevNodeId = triggerNode.getId();
            for (Map.Entry<String, List<String>> entry : responseConfig.entrySet()) {
                for (String templateName : entry.getValue()) {
                    Map<String, Object> templateConfig = buildTemplateConfig(templateName, variableConfig, fixedVarsConfig);
                    ChatbotFlowNode sendNode = saveNode(flowId, "SEND_TEMPLATE",
                            "Send: " + templateName, templateConfig, xCenter, yPos);
                    saveEdge(flowId, prevNodeId, sendNode.getId(), entry.getKey(), null);
                    prevNodeId = sendNode.getId();
                    yPos += 120;
                }
            }
        }
    }

    private Map<String, Object> buildTemplateConfig(String templateName,
                                                      Map<String, List<String>> variableConfig,
                                                      Map<String, Map<String, String>> fixedVarsConfig) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("templateName", templateName);
        config.put("languageCode", "en");

        // Build body params from variable_config
        List<String> vars = variableConfig.getOrDefault(templateName, List.of());
        List<Map<String, Object>> bodyParams = new ArrayList<>();
        for (int i = 0; i < vars.size(); i++) {
            String varName = vars.get(i);
            String value;

            // Check if there's a fixed value for this variable
            Map<String, String> fixedVars = fixedVarsConfig.getOrDefault(templateName, Map.of());
            if (fixedVars.containsKey(varName)) {
                value = "{{fixed:" + fixedVars.get(varName) + "}}";
            } else {
                value = "{{user." + varName.replace(" ", "_") + "}}";
            }

            bodyParams.add(Map.of("index", i + 1, "value", value));
        }
        config.put("bodyParams", bodyParams);

        // Detect document/media templates by variable names
        boolean hasLink = vars.stream().anyMatch(v -> v.contains("link"));
        boolean hasFilename = vars.stream().anyMatch(v -> v.contains("filename"));
        if (hasLink && hasFilename) {
            Map<String, String> fixedVars = fixedVarsConfig.getOrDefault(templateName, Map.of());
            config.put("headerConfig", Map.of(
                    "type", "document",
                    "url", fixedVars.getOrDefault("link", ""),
                    "filename", fixedVars.getOrDefault("filename", "")
            ));
            // Remove link/filename from body params since they're in header
            bodyParams.removeIf(p -> {
                String val = (String) p.get("value");
                return val != null && (val.contains("link") || val.contains("filename"));
            });
            config.put("bodyParams", bodyParams);
        } else {
            config.put("headerConfig", Map.of("type", "none"));
        }

        config.put("buttonConfig", List.of());
        return config;
    }

    // ===== Node/Edge helpers =====

    private ChatbotFlowNode saveNode(String flowId, String nodeType, String name,
                                      Map<String, Object> config, double x, double y) {
        ChatbotFlowNode node = ChatbotFlowNode.builder()
                .flowId(flowId)
                .nodeType(nodeType)
                .name(name)
                .config(toJson(config))
                .positionX(x)
                .positionY(y)
                .build();
        return nodeRepository.save(node);
    }

    private void saveEdge(String flowId, String sourceId, String targetId,
                           String label, Map<String, Object> conditionConfig) {
        ChatbotFlowEdge edge = ChatbotFlowEdge.builder()
                .flowId(flowId)
                .sourceNodeId(sourceId)
                .targetNodeId(targetId)
                .conditionLabel(label)
                .conditionConfig(conditionConfig != null ? toJson(conditionConfig) : null)
                .sortOrder(0)
                .build();
        edgeRepository.save(edge);
    }

    // ===== JSON parsing helpers =====

    private Map<String, List<String>> parseResponseConfig(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Map<String, String>> parseFixedVarsConfig(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJsonObject(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return null;
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    public record MigrationResult(int created, int skipped, List<String> errors) {}
}
