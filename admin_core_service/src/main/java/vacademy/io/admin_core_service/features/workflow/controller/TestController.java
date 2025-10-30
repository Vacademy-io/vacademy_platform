package vacademy.io.admin_core_service.features.workflow.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowEngineService;
import vacademy.io.common.auth.dto.UserDTO;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/open/v1")
@RequiredArgsConstructor
public class TestController {

    @Autowired
    private WorkflowEngineService workflowEngineService;

    @GetMapping("/test")
    public String test() {
         workflowEngineService.run("wf_inactive_check_002", Map.of("user",getSampleUser(),"packageSessionIds", List.of("17c186ce-a03d-44ac-9183-325e4312860b","c9ffb3e6-2a9e-4b34-85f7-044669fd35f4")));
         return "done";
    }

    public UserDTO getSampleUser() {
        UserDTO user = new UserDTO();

        user.setId("123e4567-e89b-12d3-a456-426614174000");
        user.setUsername("punitsreq1");
        user.setEmail("punitpunde123@gmail.com");
        user.setFullName("Punit Punde");
        user.setAddressLine("123, MG Road");
        user.setCity("Pune");
        user.setRegion("Maharashtra");
        user.setPinCode("411001");
        user.setMobileNumber("+91-9876543210");
        user.setPassword("radno@234");
        return user;
    }
}
