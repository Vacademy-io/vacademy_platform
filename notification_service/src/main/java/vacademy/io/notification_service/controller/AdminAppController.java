package vacademy.io.notification_service.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.notification_service.dto.AdminAppLinkRequest;
import vacademy.io.notification_service.service.AdminAppLinkService;

/**
 * Endpoint for the admin dashboard to request the Vacademy Admin mobile app
 * download link over WhatsApp (sent from the platform-default Vidyayatan
 * account) plus an internal notification of who requested it.
 */
@Slf4j
@RestController
@RequestMapping("notification-service/v1/admin-app")
public class AdminAppController {

    private final AdminAppLinkService adminAppLinkService;

    @Autowired
    public AdminAppController(AdminAppLinkService adminAppLinkService) {
        this.adminAppLinkService = adminAppLinkService;
    }

    @PostMapping("/request-link")
    public ResponseEntity<String> requestLink(@RequestBody AdminAppLinkRequest request) {
        adminAppLinkService.requestAppLink(request);
        return ResponseEntity.ok("App link sent successfully");
    }
}
