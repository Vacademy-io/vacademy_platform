package vacademy.io.community_service.feature.status.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.community_service.feature.status.dto.StatusIncidentDto;
import vacademy.io.community_service.feature.status.service.StatusIncidentService;

import java.util.List;

/**
 * Public, unauthenticated read access to status-page incidents.
 * Powers the customer-facing health dashboard.
 */
@RestController
@RequestMapping("/community-service/public/v1/status")
public class PublicStatusIncidentController {

    @Autowired
    private StatusIncidentService statusIncidentService;

    @GetMapping("/incidents")
    public ResponseEntity<List<StatusIncidentDto>> getIncidents() {
        return ResponseEntity.ok(statusIncidentService.listIncidents());
    }
}
