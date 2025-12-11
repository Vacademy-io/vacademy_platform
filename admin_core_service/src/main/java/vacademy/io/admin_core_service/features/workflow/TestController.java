package vacademy.io.admin_core_service.features.workflow;

import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.scheduler.WorkflowExecutionJob;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {
    @Autowired
    private WorkflowExecutionJob workflowExecutionJob;

    @GetMapping
    public void test() throws JobExecutionException {
        workflowExecutionJob.execute(null);
    }

    public UserDTO getUser(){
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail("punit@vidyayatan.com");
        return userDTO;
    }
}
