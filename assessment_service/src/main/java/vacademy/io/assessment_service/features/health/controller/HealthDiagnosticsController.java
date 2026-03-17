package vacademy.io.assessment_service.features.health.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.health.controller.BaseHealthController;

/**
 * Health endpoints for assessment-service.
 * /ping, /db, /complete are inherited from BaseHealthController.
 */
@RestController
@RequestMapping("/assessment-service/health")
public class HealthDiagnosticsController extends BaseHealthController {
}
