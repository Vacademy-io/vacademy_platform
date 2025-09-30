package vacademy.io.admin_core_service.features.workflow.automation_visualization.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.dto.WorkflowStepDto;
import vacademy.io.admin_core_service.features.workflow.automation_visualization.service.AutomationParserService;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/v1/automations")
public class AutomationVisualizationController {

    @Autowired
    private AutomationParserService automationParserService;

    @GetMapping("/{workflowId}/diagram")
    public ResponseEntity<List<WorkflowStepDto>> getWorkflowDiagram(@PathVariable String workflowId) {
        Map<String, String> nodeTemplates = getHardcodedWorkflowJson();
        try {
            // The response is now a simple list of steps
            List<WorkflowStepDto> sequence = automationParserService.parse(nodeTemplates);
            return ResponseEntity.ok(sequence);
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }

    // This method remains the same, providing the raw data
    private Map<String, String> getHardcodedWorkflowJson() {
        Map<String, String> nodes = new LinkedHashMap<>();

        nodes.put("start_node", """
            {
                "outputDataPoints": [], 
                "routing": [{ "type": "goto", "targetNodeId": "find_learners" }]
            }""");

        nodes.put("find_learners", """
            {
                "prebuiltKey": "getSSIGMByStatusAndPackageSessionIds",
                "params": { "packageSessionIds": "#ctx['packageSessionIds']" },
                "routing": [ { "operation": "SWITCH", "on": "#ctx['workflowId']", "cases": {
                    "wf_demo_morning_001": { "type": "goto", "targetNodeId": "send_demo_email" },
                    "wf_paid_morning_001": { "type": "goto", "targetNodeId": "send_paid_email" }
                } } ]
            }""");

        nodes.put("send_demo_email", """
            {
                "dataProcessor": "ITERATOR", "config": { "on": "#ctx['ssigmList']", "forEach": {
                    "operation": "SWITCH", "on": "#ctx['item']['remainingDays']", "eval": "emailData",
                    "cases": { "7": [{ "subject": "✨ Your Day 1 FREE Yoga Invitation" }] }
                } }, "routing": [{ "type": "goto", "targetNodeId": "send_final_email" }]
            }""");

        nodes.put("send_paid_email", """
            {
                "dataProcessor": "ITERATOR", "config": { "on": "#ctx['ssigmList']", "forEach": {
                    "operation": "SWITCH", "on": "#ctx['item']['remainingDays']", "eval": "emailData",
                    "cases": { "30": [{ "subject": "✨ Welcome to Your Premium Plan" }] }
                } }, "routing": [{ "type": "goto", "targetNodeId": "send_final_email" }]
            }""");

        nodes.put("send_final_email", """
            { "forEach": { "operation": "SEND_EMAIL" }, "routing": [] }
            """);

        return nodes;
    }
}