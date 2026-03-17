package vacademy.io.media_service.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.health.controller.BaseHealthController;

/**
 * Health endpoints for media-service.
 * /ping, /db, /complete are inherited from BaseHealthController.
 */
@RestController
@RequestMapping("/media-service/health")
public class HealthDiagnosticsController extends BaseHealthController {
}
