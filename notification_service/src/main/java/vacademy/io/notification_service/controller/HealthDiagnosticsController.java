package vacademy.io.notification_service.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.health.controller.BaseHealthController;

/**
 * Health endpoints for notification-service.
 * /ping, /db, /complete are inherited from BaseHealthController.
 */
@RestController
@RequestMapping("/notification-service/health")
public class HealthDiagnosticsController extends BaseHealthController {
}
