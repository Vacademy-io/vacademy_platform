package vacademy.io.admin_core_service.features.workflow.automation_visualization.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.AutomationDiagramDTO;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.admin_core_service.features.workflow.entity.Workflow;
import vacademy.io.admin_core_service.features.workflow.entity.WorkflowNodeMapping;
import vacademy.io.admin_core_service.features.workflow.repository.NodeTemplateRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowNodeMappingRepository;
import vacademy.io.admin_core_service.features.workflow.repository.WorkflowRepository;

import java.io.IOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin-core-service/open/v1/automations")
public class AutomationVisualizationController {

    @Autowired
    private AutomationParserService automationParserService;

    @Autowired
    private WorkflowRepository workflowRepository;

    @Autowired
    private WorkflowNodeMappingRepository workflowNodeMappingRepository;

    @Autowired
    private NodeTemplateRepository nodeTemplateRepository; // Required to fetch templates

    @GetMapping("/{workflowId}/diagram")
    public ResponseEntity<AutomationDiagramDTO> getWorkflowDiagram(@PathVariable String workflowId) {
        try{
            // Step 1: Find the workflow by its string ID (e.g., "wf_demo_morning_001")
            Optional<Workflow> workflowOptional = workflowRepository.findById(workflowId);
            if (workflowOptional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            Workflow workflow = workflowOptional.get();

            // Step 2: Fetch all node mappings for this workflow, ordered by their sequence.
            List<WorkflowNodeMapping> nodeMappings = workflowNodeMappingRepository.findByWorkflowIdOrderByNodeOrderAsc(workflow.getId());
            if (nodeMappings.isEmpty()) {
                return ResponseEntity.ok(AutomationDiagramDTO.builder().nodes(Collections.emptyList()).edges(Collections.emptyList()).build());
            }

            // Step 3: Efficiently fetch all required NodeTemplates in a single query.
            List<String> templateIds = nodeMappings.stream()
                    .map(WorkflowNodeMapping::getNodeTemplateId)
                    .distinct()
                    .collect(Collectors.toList());
            Map<String, String> templateIdToConfigMap = nodeTemplateRepository.findAllById(templateIds).stream()
                    .collect(Collectors.toMap(NodeTemplate::getId, NodeTemplate::getConfigJson));

            // Step 4: Create the final map of [nodeId -> configJson] for the parser.
            // Using LinkedHashMap preserves the execution order.
            Map<String, String> nodeTemplates = nodeMappings.stream()
                    .collect(Collectors.toMap(
                            WorkflowNodeMapping::getNodeTemplateId,
                            mapping -> templateIdToConfigMap.get(mapping.getNodeTemplateId()),
                            (u, v) -> u, // In case of duplicates, keep the first one
                            LinkedHashMap::new
                    ));

            try {
                // Step 5: Pass the dynamically constructed map to the parser.
                AutomationDiagramDTO diagram = automationParserService.parse(nodeTemplates);
                return ResponseEntity.ok(diagram);
            } catch (IOException e) {
                e.printStackTrace();
                return ResponseEntity.internalServerError().build();
            }
        }catch (Exception e){
            e.printStackTrace();
            throw e;
        }
    }
}