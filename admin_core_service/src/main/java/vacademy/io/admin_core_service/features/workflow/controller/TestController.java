package vacademy.io.admin_core_service.features.workflow.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.scheduler.WorkflowDispatchJob;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {
    @Autowired
    private WorkflowDispatchJob workflowDispatchJob;

    @GetMapping("/")
    public void test() {
        workflowDispatchJob.execute(null);
    }
}

