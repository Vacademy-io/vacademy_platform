package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.reports.custom.CustomReportCatalogDTO;
import vacademy.io.admin_core_service.features.audience.dto.reports.custom.CustomReportRequest;
import vacademy.io.admin_core_service.features.audience.dto.reports.custom.CustomReportResponseDTO;
import vacademy.io.admin_core_service.features.audience.service.CustomReportService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Self-serve report builder endpoints. The catalog advertises the whitelisted dimensions / measures
 * / filters; run executes a validated spec over them. Both are RBAC-scoped like every other report.
 */
@RestController
@RequestMapping("/admin-core-service/v1/reports/custom")
@RequiredArgsConstructor
public class CustomReportController {

    private final CustomReportService customReportService;

    /** The whitelisted fields the builder understands, with pre-resolved filter options. */
    @GetMapping("/catalog")
    public ResponseEntity<CustomReportCatalogDTO> getCatalog(
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(customReportService.getCatalog(instituteId, user.getUserId()));
    }

    /** Execute a validated dimensions/measures/filters spec; returns a tabular grid. */
    @PostMapping("/run")
    public ResponseEntity<CustomReportResponseDTO> run(
            @RequestBody CustomReportRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(customReportService.run(request, user.getUserId()));
    }
}
