package vacademy.io.admin_core_service.features.workflow.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/open/test")
public class TestController {

    @GetMapping("/")
    public Map<String, String> test() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "Test endpoint working");
        response.put("message", "Workflow system is running");
        return response;
    }
}
