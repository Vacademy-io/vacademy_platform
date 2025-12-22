package vacademy.io.admin_core_service.features.workflow;

import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.workflow.scheduler.WorkflowExecutionJob;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {
    @Autowired
    private WorkflowEngineService workflowEngineService;

    @GetMapping
    public Map<String,Object> test() {
      return  workflowEngineService.run("wf_admin_login",Map.of("instituteId","0bd9421e-2e74-4cfb-bbee-03bc09845bc6","user",getUser()));
    }

    public UserDTO getUser(){
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail("punit@vidyayatan.com");
        userDTO.setUsername("pufb121");
        userDTO.setFullName("Rahufaie r3");
        userDTO.setMobileNumber("125687890");
        userDTO.setPassword("kjnjfg");
        return userDTO;
    }
    @PostMapping("/wf")
    public void testTap(@RequestParam String wfId){
        workflowEngineService.run(wfId,Map.of("user",getUser()));
    }
}
