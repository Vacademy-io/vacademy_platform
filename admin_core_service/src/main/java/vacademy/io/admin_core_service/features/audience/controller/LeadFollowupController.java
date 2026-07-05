package vacademy.io.admin_core_service.features.audience.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.dto.CloseLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.CreateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.LeadFollowupDto;
import vacademy.io.admin_core_service.features.audience.dto.UpdateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.service.LeadFollowupService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/lead-followup")
@RequiredArgsConstructor
public class LeadFollowupController {

    private final LeadFollowupService leadFollowupService;

    @PostMapping
    public ResponseEntity<LeadFollowupDto> create(@RequestBody CreateLeadFollowupRequest request,
                                                   @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leadFollowupService.create(request, user));
    }

    @GetMapping("/{audienceResponseId}")
    public ResponseEntity<List<LeadFollowupDto>> listForLead(@PathVariable String audienceResponseId,
                                                             @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leadFollowupService.listForLead(audienceResponseId, user));
    }

    /**
     * Legacy no-param shape returns the caller's own pending follow-ups.
     * With {@code instituteId}: hierarchy-scoped callers get the manager view
     * (own + counsellor-role reports'); pure admins get the institute, and
     * {@code counsellorUserId} narrows to one user (scope-validated).
     */
    @GetMapping("/my-pending")
    public ResponseEntity<List<LeadFollowupDto>> myPending(
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "counsellorUserId", required = false) String counsellorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leadFollowupService.myPending(user, instituteId, counsellorUserId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LeadFollowupDto> update(@PathVariable String id,
                                                   @RequestBody UpdateLeadFollowupRequest request,
                                                   @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leadFollowupService.update(id, request));
    }

    @PutMapping("/{id}/close")
    public ResponseEntity<LeadFollowupDto> close(@PathVariable String id,
                                                  @RequestBody CloseLeadFollowupRequest request,
                                                  @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(leadFollowupService.close(id, request, user));
    }
}
