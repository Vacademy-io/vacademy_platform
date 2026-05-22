package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.LeadStatusDTO;
import vacademy.io.admin_core_service.features.audience.service.LeadStatusService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.stream.Collectors;

/**
 * CRUD for the per-institute lead status catalog, plus setting a lead's current status.
 * Replaces the customStatuses that previously lived in the LEAD_SETTING JSON.
 */
@RestController
@RequestMapping("/admin-core-service/v1/lead-status")
@RequiredArgsConstructor
public class LeadStatusController {

    private final LeadStatusService leadStatusService;

    /** List the institute's statuses (seeds the starter set on first access). */
    @GetMapping
    public ResponseEntity<List<LeadStatusDTO>> list(@RequestParam String instituteId) {
        List<LeadStatusDTO> dtos = leadStatusService.listForInstitute(instituteId).stream()
                .map(LeadStatusDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping
    public ResponseEntity<LeadStatusDTO> create(@RequestParam String instituteId,
                                                @RequestBody LeadStatusDTO dto,
                                                @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(LeadStatusDTO.from(leadStatusService.create(instituteId, dto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LeadStatusDTO> update(@PathVariable String id,
                                                @RequestBody LeadStatusDTO dto,
                                                @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(LeadStatusDTO.from(leadStatusService.update(id, dto)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id,
                                       @RequestAttribute("user") CustomUserDetails user) {
        leadStatusService.deactivate(id);
        return ResponseEntity.ok().build();
    }

    /** Set a lead's current status (manual change from the leads UI). */
    @PostMapping("/lead/{audienceResponseId}")
    public ResponseEntity<String> setLeadStatus(@PathVariable String audienceResponseId,
                                                @RequestParam String statusId,
                                                @RequestParam(required = false, defaultValue = "MANUAL") String source,
                                                @RequestAttribute("user") CustomUserDetails user) {
        leadStatusService.changeLeadStatus(audienceResponseId, statusId,
                user != null ? user.getUserId() : null, source);
        return ResponseEntity.ok("Lead status updated");
    }
}
