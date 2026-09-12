package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.audience.dto.LeadSlaSettingsDTO;
import vacademy.io.admin_core_service.features.audience.service.LeadSlaConfigService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Read/write the table-backed TAT + Follow-up SLA config (replaces the LEAD_SETTING JSON).
 */
@RestController
@RequestMapping("/admin-core-service/v1/lead-sla-config")
@RequiredArgsConstructor
public class LeadSlaConfigController {

    private final LeadSlaConfigService leadSlaConfigService;

    @GetMapping
    public ResponseEntity<LeadSlaSettingsDTO> get(@RequestParam String instituteId) {
        return ResponseEntity.ok(leadSlaConfigService.getSettings(instituteId));
    }

    @PutMapping
    @Auditable(
            entityType = "LEAD_SLA_CONFIG",
            action = "UPDATE",
            entityIdExpr = "#instituteId",
            captureBefore = "@leadSlaConfigService.getSettings(#instituteId)",
            // Not "updated lead ..." — the audit table's name matcher would read
            // the rest of that sentence as a lead's name and bold it.
            descriptionExpr = "'updated TAT and follow-up SLA settings'")
    public ResponseEntity<String> save(@RequestParam String instituteId,
                                       @RequestBody LeadSlaSettingsDTO dto,
                                       @RequestAttribute("user") CustomUserDetails user) {
        leadSlaConfigService.save(instituteId, dto);
        return ResponseEntity.ok("Lead SLA config saved");
    }
}
