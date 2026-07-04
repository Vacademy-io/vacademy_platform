package vacademy.io.admin_core_service.features.counsellor_workbench.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
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
    // Config (leads_team_id + rating strategy)
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/config")
    public ResponseEntity<WorkbenchConfig> getConfig(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(configService.get(instituteId));
    }

    /**
     * Partial upsert of the workbench config. Two frontend pages PUT here
     * with different payload shapes:
     * <ul>
     *   <li>Leads-team picker — {@code {institute_id, leads_team_id}} only
     *       (leads_team_id may be an explicit null to CLEAR the team);</li>
     *   <li>Rating settings — the full config echo with rating fields set
     *       (its leads_team_id is whatever GET returned, possibly null when
     *       the team was never configured).</li>
     * </ul>
     * setLeadsTeam(null) REMOVES the team, so we only honour a null
     * leads_team_id when the payload carries no rating fields — a
     * rating-settings save must never wipe an existing team just because
     * the echoed leads_team_id was null.
     */
    @PutMapping("/config")
    public ResponseEntity<WorkbenchConfig> updateConfig(@RequestBody WorkbenchConfig request) {
        boolean hasRatingFields = request.getStrategyType() != null
                || request.getStartingRating() != null
                || request.getWindowDays() != null
                || request.getSuccessStatusKeys() != null
                || request.getWConversion() != null
                || request.getWVelocity() != null
                || request.getIdealVelocityHours() != null
                || request.getWorstVelocityHours() != null
                || request.getMinSampleSize() != null;
        if (hasRatingFields) {
            configService.upsertRatingStrategy(request);
        }
        if (request.getLeadsTeamId() != null || !hasRatingFields) {
            configService.setLeadsTeam(request.getInstituteId(), request.getLeadsTeamId());
        }
        return ResponseEntity.ok(configService.get(request.getInstituteId()));
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
    public ResponseEntity<Page<WorkbenchLeadDTO>> myLeads(
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
    public ResponseEntity<Page<WorkbenchCounsellorDTO>> listCounsellors(
            @PathVariable String teamId,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(workbenchService.listCounsellorsForTeam(
                instituteId, teamId, search, status, page, size, user));
    }

    /**
     * Leads currently assigned to a specific counsellor. The CSO / manager
     * detail drawer hits this when opening someone else's profile — the
     * /me/leads endpoint is auth-scoped to the caller so it can't surface
     * another counsellor's leads.
     */
    @GetMapping("/counsellors/{userId}/leads")
    public ResponseEntity<Page<WorkbenchLeadDTO>> counsellorLeads(
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
    // Bulk assign (multi-selected leads from the leads / campaign-users list)
    // ────────────────────────────────────────────────────────────────

    @PostMapping("/assign/preview")
    public ResponseEntity<AssignLeadsResultDTO> previewAssign(
            @RequestBody AssignLeadsRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(reassignService.assignPreview(request, user));
    }

    @PostMapping("/assign")
    public ResponseEntity<AssignLeadsResultDTO> assign(
            @RequestBody AssignLeadsRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(reassignService.assign(request, user));
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

    // ────────────────────────────────────────────────────────────────
    // Per-lead transfer chain
    // ────────────────────────────────────────────────────────────────

    /**
     * Returns the counsellor-assignment chain for one lead, oldest first.
     * Powers the expand-row "transfer history" in the counsellor drawer's
     * Leads tab. RBAC: caller must have access to the lead's current
     * assignee (enforced in the service layer).
     *
     * The {@code leadUserId} path variable is the lead's user_id (same id
     * carried by {@link WorkbenchLeadDTO#getUserId()}), not the
     * user_lead_profile.id.
     */
    @GetMapping("/leads/{leadUserId}/transfers")
    public ResponseEntity<List<LeadTransferDTO>> leadTransfers(
            @PathVariable String leadUserId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(workbenchService.leadTransfers(instituteId, leadUserId, user));
    }
}
