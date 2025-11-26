package vacademy.io.admin_core_service.features.workflow;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {
    @Autowired
    private WorkflowEngineService workflowEngineService;

    @GetMapping
    public void test(){
        workflowEngineService.run("wf_send_creds_v1", Map.of("user",getUser()));
    }

    public UserDTO getUser(){
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail("punit@vidyayatan.com");
        return userDTO;
    }
}
