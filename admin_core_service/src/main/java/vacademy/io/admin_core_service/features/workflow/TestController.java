package vacademy.io.admin_core_service.features.workflow;

import org.quartz.JobExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.InstituteInfoDTO;
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
      return  workflowEngineService.run("wf_ld_group_sync",Map.of("instituteId","0bd9421e-2e74-4cfb-bbee-03bc09845bc6","subOrgAdmin",getUser(),"user",getUser1(),"packageId","66f1d203-6dd6-4233-bf7f-01c489670a22","subOrg",getInstitute(),"member",getUser1()));
    }

    public UserDTO getUser(){
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail("punit@vidyayateean.com");
        userDTO.setUsername("pufdbee121");
        userDTO.setFullName("Rahufaie r3");
        userDTO.setMobileNumber("125687890");
        userDTO.setPassword("kjnjfg");
        return userDTO;
    }

    public InstituteInfoDTO getInstitute(){
        InstituteInfoDTO instituteInfoDTO = new InstituteInfoDTO();
        instituteInfoDTO.setInstituteName("kwlf");
        return instituteInfoDTO;
    }
    public UserDTO getUser1(){
        UserDTO userDTO = new UserDTO();
        userDTO.setEmail("punitpundeeee@gmjjjail.com");
        userDTO.setUsername("pefbdee121");
        userDTO.setFullName("Rahudfaie r3");
        userDTO.setMobileNumber("125687890");
        userDTO.setPassword("kjnjfg");
        return userDTO;
    }
    @PostMapping("/wf")
    public void testTap(@RequestParam String wfId){
        workflowEngineService.run(wfId,Map.of("user",getUser()));
    }
}
