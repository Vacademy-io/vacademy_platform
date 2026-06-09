package vacademy.io.admin_core_service.features.counsellor_workbench.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.*;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorReassignService;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorWorkbenchService;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.LeadWorkbenchSettingService;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.WorkbenchConfig;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.util.List;

/**
 * Counsellor-facing workbench endpoints.
 *
 * /me/*  resolve the caller's home team automatically (scope = own team +
 *        descendants under leads_team_id). Managers with broader scope use
 *        the /team/{teamId}/* variants to look at a specific subtree.
 */
@RestController
@RequestMapping("/admin-core-service/v1/counsellor-workbench")
@RequiredArgsConstructor
public class CounsellorWorkbenchController {

    private final CounsellorWorkbenchService workbenchService;
    private final CounsellorReassignService reassignService;
    private final LeadWorkbenchSettingService configService;

    // ────────────────────────────────────────────────────────────────
    // Config (leads_team_id)
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/config")
    public ResponseEntity<WorkbenchConfig> getConfig(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(configService.get(instituteId));
    }

    @PutMapping("/config")
    public ResponseEntity<WorkbenchConfig> updateConfig(@RequestBody WorkbenchConfig request) {
        return ResponseEntity.ok(configService.setLeadsTeam(request.getInstituteId(), request.getLeadsTeamId()));
    }

    // ────────────────────────────────────────────────────────────────
    // Me
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/me/team")
    public ResponseEntity<WorkbenchTeamDTO> myTeam(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(workbenchService.myTeam(instituteId, user));
    }

    @GetMapping("/me/leads")
    public ResponseEntity<List<WorkbenchLeadDTO>> myLeads(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(workbenchService.myLeads(instituteId, user, status, page, size));
    }

    // ────────────────────────────────────────────────────────────────
    // Team-wide views
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/team/{teamId}/counsellors")
    public ResponseEntity<List<WorkbenchCounsellorDTO>> listCounsellors(
            @PathVariable String teamId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(workbenchService.listCounsellorsForTeam(instituteId, teamId, user));
    }

    /**
     * Leads currently assigned to a specific counsellor. The CSO / manager
     * detail drawer hits this when opening someone else's profile — the
     * /me/leads endpoint is auth-scoped to the caller so it can't surface
     * another counsellor's leads.
     */
    @GetMapping("/counsellors/{userId}/leads")
    public ResponseEntity<List<WorkbenchLeadDTO>> counsellorLeads(
            @PathVariable String userId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(workbenchService.leadsForCounsellor(instituteId, userId, status, page, size));
    }

    // ────────────────────────────────────────────────────────────────
    // Counsellor status flip
    // ────────────────────────────────────────────────────────────────

    @PatchMapping("/counsellors/{userId}/status")
    public ResponseEntity<StatusChangeResponseDTO> setStatus(
            @PathVariable String userId,
            @RequestBody SetStatusRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(
                workbenchService.setStatus(request.getInstituteId(), userId, request.getStatus(), user));
    }

    // ────────────────────────────────────────────────────────────────
    // Reassign
    // ────────────────────────────────────────────────────────────────

    @PostMapping("/reassign/preview")
    public ResponseEntity<ReassignResultDTO> previewReassign(
            @RequestBody ReassignRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(reassignService.preview(request, user));
    }

    @PostMapping("/reassign")
    public ResponseEntity<ReassignResultDTO> reassign(
            @RequestBody ReassignRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(reassignService.reassign(request, user));
    }

    // ────────────────────────────────────────────────────────────────
    // Activity feed
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/counsellors/{userId}/activity")
    public ResponseEntity<List<ActivityFeedItemDTO>> activity(
            @PathVariable String userId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "from", required = false) Long fromMillis,
            @RequestParam(value = "to", required = false) Long toMillis,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        Timestamp from = fromMillis != null ? new Timestamp(fromMillis) : null;
        Timestamp to = toMillis != null ? new Timestamp(toMillis) : null;
        return ResponseEntity.ok(workbenchService.activityFeed(userId, instituteId, from, to, limit));
    }
}
