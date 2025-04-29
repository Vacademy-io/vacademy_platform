package vacademy.io.community_service.test;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/community-service/test/v1")
public class TestController {

    @GetMapping("/hello")
    public ResponseEntity<String> hello(@RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok("Hello Community Service");
    }

}
