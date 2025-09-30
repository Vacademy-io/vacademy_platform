package vacademy.io.admin_core_service.features.workflow.automation_visualization.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.WorkflowStepDto;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AutomationParserService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final Map<String, String> TERMINOLOGY_MAP = new HashMap<>();

    static {
        TERMINOLOGY_MAP.put("getSSIGMByStatusAndPackageSessionIds", "Find Learners by Package");
        TERMINOLOGY_MAP.put("createLiveSession", "Create Live Sessions");
        TERMINOLOGY_MAP.put("createSessionSchedule", "Schedule Live Sessions");
        TERMINOLOGY_MAP.put("createSessionParticipent", "Add Participants to Session");
        TERMINOLOGY_MAP.put("sendEmail", "Send Email to Learners");
    }

    public List<WorkflowStepDto> parse(Map<String, String> nodeTemplates) throws IOException {
        if (nodeTemplates.isEmpty()) {
            return Collections.emptyList();
        }
        String startNodeId = nodeTemplates.keySet().iterator().next();
        return buildSequence(startNodeId, nodeTemplates, new HashSet<>());
    }

    private List<WorkflowStepDto> buildSequence(String currentNodeId, Map<String, String> allNodes, Set<String> visited) {
        if (currentNodeId == null || visited.contains(currentNodeId)) {
            return Collections.singletonList(WorkflowStepDto.builder().title("End of Flow").type("END").build());
        }
        visited.add(currentNodeId);

        String json = allNodes.get(currentNodeId);
        if (json == null) {
            return Collections.singletonList(WorkflowStepDto.builder().title("End of Flow").type("END").build());
        }

        try {
            Map<String, Object> nodeData = objectMapper.readValue(json, new TypeReference<>() {});
            WorkflowStepDto currentStep = parseNodeToStep(nodeData);
            List<WorkflowStepDto> sequence = new ArrayList<>();
            sequence.add(currentStep);

            List<Map<String, Object>> routingList = (List<Map<String, Object>>) nodeData.get("routing");

            if (routingList != null && !routingList.isEmpty()) {
                Map<String, Object> routing = routingList.get(0);

                if ("goto".equals(routing.get("type"))) {
                    String nextNodeId = (String) routing.get("targetNodeId");
                    sequence.addAll(buildSequence(nextNodeId, allNodes, visited));
                } else if ("SWITCH".equals(routing.get("operation"))) {
                    currentStep.setType("LOGIC");
                    Map<String, Map<String, String>> cases = (Map<String, Map<String, String>>) routing.get("cases");
                    if (cases != null) {
                        List<WorkflowStepDto.Branch> branches = new ArrayList<>();
                        for (Map.Entry<String, Map<String, String>> caseEntry : cases.entrySet()) {
                            branches.add(WorkflowStepDto.Branch.builder()
                                    .condition("If Workflow is: " + caseEntry.getKey())
                                    .steps(buildSequence(caseEntry.getValue().get("targetNodeId"), allNodes, new HashSet<>(visited)))
                                    .build());
                        }
                        currentStep.setBranches(branches);
                    }
                }
            } else {
                sequence.add(WorkflowStepDto.builder().title("End of Flow").type("END").build());
            }
            return sequence;
        } catch (IOException e) {
            return Collections.singletonList(WorkflowStepDto.builder().title("Error Parsing Node").type("unknown").build());
        }
    }

    private WorkflowStepDto parseNodeToStep(Map<String, Object> nodeData) {
        if (nodeData.containsKey("prebuiltKey")) {
            String key = (String) nodeData.get("prebuiltKey");
            return WorkflowStepDto.builder()
                    .title(TERMINOLOGY_MAP.getOrDefault(key, key))
                    .description("Fetches data from the database.")
                    .type("ACTION")
                    .details(cleanSpelExpressions(Map.of("parameters", nodeData.get("params"))))
                    .build();
        }
        if (nodeData.containsKey("dataProcessor")) {
            return parseDataProcessorStep(nodeData);
        }
        if (nodeData.containsKey("outputDataPoints")) {
            // This is the START node, extract its trigger data.
            return WorkflowStepDto.builder()
                    .title("Start Automation")
                    .description("The workflow begins and initial data is prepared.")
                    .type("START")
                    .details(extractTriggerData(nodeData)) // <-- NEW: Extracting trigger data
                    .build();
        }
        if (nodeData.containsKey("forEach") && "SEND_EMAIL".equals(((Map<String, Object>) nodeData.get("forEach")).get("operation"))) {
            return WorkflowStepDto.builder()
                    .title("Send Email")
                    .description("Sends a dynamically constructed email to each user.")
                    .type("EMAIL")
                    .build();
        }
        return WorkflowStepDto.builder().title("Unnamed Step").type("unknown").build();
    }

    private WorkflowStepDto parseDataProcessorStep(Map<String, Object> nodeData){
        Map<String, Object> config = (Map<String, Object>) nodeData.get("config");
        Map<String, Object> forEach = (Map<String, Object>) config.get("forEach");
        String on = cleanSpel((String)config.get("on"));

        if("SWITCH".equals(forEach.get("operation"))) {
            // This is the email personalization step
            String description = "For each " + on + ", a custom email is prepared based on their remaining membership days.";
            return WorkflowStepDto.builder()
                    .title("Personalize Communication")
                    .description(description)
                    .type("LOGIC")
                    .details(cleanSpelExpressions(Map.of("conditions", forEach.get("cases"))))
                    .build();
        }
        if("QUERY".equals(forEach.get("operation")) && "createLiveSession".equals(forEach.get("prebuiltKey"))){
            return WorkflowStepDto.builder()
                    .title("Create Live Sessions")
                    .description("Loops through the session data defined at the start and creates each one.")
                    .type("ACTION")
                    .details(Map.of("action", "createLiveSession"))
                    .build();
        }
        return WorkflowStepDto.builder().title("Process Data").description("Iterates over " + on).type("ACTION").build();
    }

    /**
     * Extracts and simplifies the initial data points from the start node.
     * This provides a clear summary of what triggers the workflow.
     */
    private Map<String, Object> extractTriggerData(Map<String, Object> nodeData) {
        Map<String, Object> triggerDetails = new LinkedHashMap<>();
        List<Map<String, Object>> outputs = (List<Map<String, Object>>) nodeData.get("outputDataPoints");

        for (Map<String, Object> point : outputs) {
            String fieldName = (String) point.get("fieldName");
            if ("packageSessionIds".equals(fieldName)) {
                triggerDetails.put("Target Package Session", cleanValue(point.get("compute")));
            }
            if ("liveSessions".equals(fieldName) && point.get("value") instanceof List) {
                List<Map<String, Object>> sessions = (List<Map<String, Object>>) point.get("value");
                List<Map<String, String>> sessionInfo = sessions.stream()
                        .map(s -> Map.of(
                                "title", cleanSpel((String)s.get("title")),
                                "youtubeLink", cleanSpel((String)s.get("defaultMeetLink"))
                        ))
                        .collect(Collectors.toList());
                triggerDetails.put("Live Sessions to Create", sessionInfo);
            }
        }
        return triggerDetails;
    }


    // --- Helper methods to clean SpEL expressions ---
    @SuppressWarnings("unchecked")
    private Map<String, Object> cleanSpelExpressions(Map<String, Object> map) {
        Map<String, Object> cleanedMap = new HashMap<>();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            cleanedMap.put(entry.getKey(), cleanValue(entry.getValue()));
        }
        return cleanedMap;
    }

    @SuppressWarnings("unchecked")
    private Object cleanValue(Object value) {
        if (value instanceof String) return cleanSpel((String) value);
        if (value instanceof Map) return cleanSpelExpressions((Map<String, Object>) value);
        if (value instanceof List) return ((List<Object>) value).stream().map(this::cleanValue).collect(Collectors.toList());
        return value;
    }

    private String cleanSpel(String expression) {
        if (expression == null) return null;
        // This regex is enhanced to remove T(...) expressions and surrounding quotes.
        return expression
                .replaceAll("T\\([^)]+\\)\\.asList\\(([^)]+)\\)", "$1")
                .replaceAll("#ctx(?:\\.item)?\\['([^']*)'\\]", "$1")
                .replaceAll("'", "");
    }
}