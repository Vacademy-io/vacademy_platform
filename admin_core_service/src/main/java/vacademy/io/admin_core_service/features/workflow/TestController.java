package vacademy.io.admin_core_service.features.workflow;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {
    @Autowired
    private WorkflowEngineService workflowEngineService;

    @GetMapping
    public void test(){
        workflowEngineService.run("wf-test", Map.of());
    }
}
