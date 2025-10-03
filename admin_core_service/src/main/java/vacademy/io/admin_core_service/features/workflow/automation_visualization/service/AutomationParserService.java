package vacademy.io.admin_core_service.features.workflow.automation_visualization.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers.StepParser;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.parsers.StepParserRegistry;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AutomationParserService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final StepParserRegistry parserRegistry;

    // This map provides friendly names for known database operations
    public static final Map<String, String> TERMINOLOGY_MAP = new HashMap<>();

    static {
        TERMINOLOGY_MAP.put("getSSIGMByStatusAndPackageSessionIds", "Find Learners by Package");
        TERMINOLOGY_MAP.put("createLiveSession", "Create Live Sessions");
        TERMINOLOGY_MAP.put("createSessionSchedule", "Schedule Live Sessions");
        TERMINOLOGY_MAP.put("createSessionParticipent", "Add Participants to Session");
        TERMINOLOGY_MAP.put("sendEmail", "Send Email to Learners");
    }

    public AutomationParserService(StepParserRegistry parserRegistry) {
        this.parserRegistry = parserRegistry;
    }

    /**
     * Parses a map of node configurations into a complete diagram DTO containing all nodes and edges.
     * This method is now fully dynamic and relies on the parser registry.
     */
    public AutomationDiagramDTO parse(Map<String, String> nodeTemplates) throws IOException {
        List<AutomationDiagramDTO.Node> nodes = new ArrayList<>();
        List<AutomationDiagramDTO.Edge> edges = new ArrayList<>();

        for (Map.Entry<String, String> entry : nodeTemplates.entrySet()) {
            String nodeId = entry.getKey();
            String json = entry.getValue();
            if (json == null || json.isBlank()) continue;

            Map<String, Object> nodeData = objectMapper.readValue(json, new TypeReference<>() {});

            // 1. Find the correct parser for this node type from the registry and parse it.
            Optional<StepParser> parser = parserRegistry.getParser(nodeData);
            AutomationDiagramDTO.Node node = parser.map(p -> p.parse(nodeId, nodeData))
                    .orElse(AutomationDiagramDTO.Node.builder().id(nodeId).title("Unknown Step").type("UNKNOWN").build());
            nodes.add(node);

            // 2. Parse the routing information to create the edges (connections).
            List<Map<String, Object>> routingList = (List<Map<String, Object>>) nodeData.get("routing");
            if (routingList != null) {
                edges.addAll(parseEdges(nodeId, routingList));
            }
        }

        return AutomationDiagramDTO.builder().nodes(nodes).edges(edges).build();
    }

    /**
     * Translates the "routing" section of a node's JSON into a list of Edge DTOs,
     * creating clear, human-readable labels for all decision branches.
     */
    private List<AutomationDiagramDTO.Edge> parseEdges(String sourceNodeId, List<Map<String, Object>> routingList) {
        List<AutomationDiagramDTO.Edge> edges = new ArrayList<>();
        int i = 0;
        for (Map<String, Object> routing : routingList) {
            if ("goto".equals(routing.get("type"))) {
                edges.add(createEdge(sourceNodeId, (String) routing.get("targetNodeId"), "Next", i++));
            } else if ("SWITCH".equals(routing.get("operation"))) {
                Map<String, Map<String, String>> cases = (Map<String, Map<String, String>>) routing.get("cases");
                if (cases != null) {
                    for (Map.Entry<String, Map<String, String>> caseEntry : cases.entrySet()) {
                        String friendlyWorkflowId = caseEntry.getKey().replace("wf_", "").replace("_", " ");
                        String conditionLabel = "If: " + humanizeIdentifier(friendlyWorkflowId);
                        edges.add(createEdge(sourceNodeId, caseEntry.getValue().get("targetNodeId"), conditionLabel, i++));
                    }
                }
            }
        }
        return edges;
    }

    private AutomationDiagramDTO.Edge createEdge(String source, String target, String label, int index) {
        // Create a more unique ID to handle multiple edges between the same nodes
        String edgeId = source + "->" + target + "_" + index;
        return AutomationDiagramDTO.Edge.builder()
                .id(edgeId)
                .sourceNodeId(source)
                .targetNodeId(target)
                .label(label)
                .build();
    }

    // --- STATIC HELPER METHODS (Public so they can be used by any parser) ---

    public static String humanizeIdentifier(String id) {
        if (id == null || id.isEmpty()) return "Untitled";
        String[] words = id.split("(?=[A-Z])|_|-");
        return Arrays.stream(words)
                .filter(s -> s != null && !s.trim().isEmpty())
                .map(s -> s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase())
                .collect(Collectors.joining(" "));
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> cleanSpelExpressions(Map<String, Object> map) {
        if (map == null) return Collections.emptyMap();
        Map<String, Object> cleanedMap = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            cleanedMap.put(humanizeIdentifier(entry.getKey()), cleanValue(entry.getValue()));
        }
        return cleanedMap;
    }

    @SuppressWarnings("unchecked")
    public static Object cleanValue(Object value) {
        if (value instanceof String) return cleanSpel((String) value);
        if (value instanceof Map) return cleanSpelExpressions((Map<String, Object>) value);
        if (value instanceof List) return ((List<Object>) value).stream().map(AutomationParserService::cleanValue).collect(Collectors.toList());
        return value;
    }

    public static String cleanSpel(String expression) {
        if (expression == null) return null;
        return expression
                .replaceAll("T\\([^)]+\\)\\.asList\\(([^)]+)\\)", "$1")
                .replaceAll("#ctx(?:\\.item)?\\['([^']*)'\\]", "$1")
                .replaceAll("'", "");
    }
}