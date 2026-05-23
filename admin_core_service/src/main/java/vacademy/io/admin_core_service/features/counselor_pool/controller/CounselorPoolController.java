package vacademy.io.admin_core_service.features.counselor_pool.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.counselor_pool.dto.*;
import vacademy.io.admin_core_service.features.counselor_pool.service.CounselorPoolService;
import vacademy.io.admin_core_service.features.counselor_pool.service.CounselorPoolShiftService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin endpoints for managing counselor pools, their audiences, members,
 * and weekly shift schedules. The actual lead-time routing engine
 * (CounselorAssignmentService) is invoked from the lead submit flow, not
 * from these endpoints.
 */
@RestController
@RequestMapping("/admin-core-service/v1/counselor-pool")
@RequiredArgsConstructor
public class CounselorPoolController {

    private final CounselorPoolService poolService;
    private final CounselorPoolShiftService shiftService;

    // ────────────────────────────────────────────────────────────────
    // Pool CRUD
    // ────────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<CounselorPoolDTO> createPool(
            @RequestBody CreatePoolRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(poolService.createPool(request, user.getUserId()));
    }

    @GetMapping
    public ResponseEntity<List<CounselorPoolDTO>> listPools(@RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(poolService.listPools(instituteId));
    }

    @GetMapping("/{poolId}")
    public ResponseEntity<CounselorPoolDTO> getPool(@PathVariable String poolId) {
        return ResponseEntity.ok(poolService.getPool(poolId));
    }

    @PatchMapping("/{poolId}")
    public ResponseEntity<CounselorPoolDTO> updatePool(
            @PathVariable String poolId,
            @RequestBody UpdatePoolRequest request) {
        return ResponseEntity.ok(poolService.updatePool(poolId, request));
    }

    @DeleteMapping("/{poolId}")
    public ResponseEntity<String> deletePool(@PathVariable String poolId) {
        poolService.deletePool(poolId);
        return ResponseEntity.ok("Pool deleted");
    }

    // ────────────────────────────────────────────────────────────────
    // Audience attachment
    // ────────────────────────────────────────────────────────────────

    @PostMapping("/{poolId}/audiences/{audienceId}")
    public ResponseEntity<String> addAudienceToPool(
            @PathVariable String poolId,
            @PathVariable String audienceId,
            @RequestAttribute("user") CustomUserDetails user) {
        poolService.addAudienceToPool(poolId, audienceId, user.getUserId());
        return ResponseEntity.ok("Audience attached");
    }

    @DeleteMapping("/{poolId}/audiences/{audienceId}")
    public ResponseEntity<String> removeAudienceFromPool(
            @PathVariable String poolId,
            @PathVariable String audienceId) {
        poolService.removeAudienceFromPool(poolId, audienceId);
        return ResponseEntity.ok("Audience detached");
    }

    /**
     * Replace the rotation order of counselors for one (pool, audience) pair.
     * Body: { counselor_user_ids: [..., ..., ...] } in the desired rotation order.
     * The backend assigns display_order = 1..N based on list position.
     */
    @PutMapping("/{poolId}/audiences/{audienceId}/order")
    public ResponseEntity<String> updateAudienceOrder(
            @PathVariable String poolId,
            @PathVariable String audienceId,
            @RequestBody UpdateAudienceOrderRequest request) {
        poolService.updateAudienceMemberOrder(poolId, audienceId, request.getCounselorUserIds());
        return ResponseEntity.ok("Order updated");
    }

    // ────────────────────────────────────────────────────────────────
    // Counselor (member) management
    // ────────────────────────────────────────────────────────────────

    @PostMapping("/{poolId}/counselors/{counselorUserId}")
    public ResponseEntity<String> addCounselorToPool(
            @PathVariable String poolId,
            @PathVariable String counselorUserId,
            @RequestAttribute("user") CustomUserDetails user) {
        poolService.addCounselorToPool(poolId, counselorUserId, user.getUserId());
        return ResponseEntity.ok("Counselor added to pool");
    }

    @DeleteMapping("/{poolId}/counselors/{counselorUserId}")
    public ResponseEntity<String> removeCounselorFromPool(
            @PathVariable String poolId,
            @PathVariable String counselorUserId) {
        poolService.removeCounselorFromPool(poolId, counselorUserId);
        return ResponseEntity.ok("Counselor removed from pool");
    }

    /**
     * Flip a counselor's status across all audiences in this pool. When marking
     * INACTIVE, the request body must include backup_counselor_user_id. The
     * acting admin is forwarded to the service so any per-lead reassign
     * (when reassign_existing_leads=true) logs the timeline event under the
     * right actor.
     */
    @PatchMapping("/{poolId}/counselors/{counselorUserId}/status")
    public ResponseEntity<String> updateMemberStatus(
            @PathVariable String poolId,
            @PathVariable String counselorUserId,
            @RequestBody UpdateMemberStatusRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        poolService.updateMemberStatus(poolId, counselorUserId, request, user);
        return ResponseEntity.ok("Status updated");
    }

    /**
     * List the pools (within the institute) where this counselor is currently
     * ACTIVE. Powers the multi-pool selector in the "Mark Inactive" dialog.
     * Pools where the counselor is already INACTIVE are excluded.
     */
    @GetMapping("/counselors/{counselorUserId}/memberships")
    public ResponseEntity<List<CounselorPoolMembershipDTO>> listCounselorMemberships(
            @PathVariable String counselorUserId,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(poolService.listActiveMembershipsForCounselor(instituteId, counselorUserId));
    }

    /**
     * Flip a counselor's status across MULTIPLE pools at once. All-or-nothing
     * — any per-pool failure rolls back the whole batch. Body carries the
     * pool_ids plus the same status/backup/reassign flag applied to each.
     * The acting admin is forwarded so per-lead reassign timeline events
     * record the right actor.
     */
    @PatchMapping("/counselors/{counselorUserId}/status-multi")
    public ResponseEntity<String> bulkUpdateMemberStatus(
            @PathVariable String counselorUserId,
            @RequestBody BulkUpdateMemberStatusRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        poolService.bulkUpdateMemberStatusAcrossPools(counselorUserId, request, user);
        return ResponseEntity.ok("Status updated");
    }

    // ────────────────────────────────────────────────────────────────
    // Weekly schedule (TIME_BASED mode)
    // ────────────────────────────────────────────────────────────────

    @GetMapping("/{poolId}/schedule")
    public ResponseEntity<List<PoolShiftDTO>> getWeeklySchedule(@PathVariable String poolId) {
        return ResponseEntity.ok(shiftService.getWeeklySchedule(poolId));
    }

    /**
     * Replace the entire weekly schedule. Validates 24/7 coverage across all
     * 7 days before any write. On any validation failure, no changes are
     * persisted.
     */
    @PutMapping("/{poolId}/schedule")
    public ResponseEntity<List<PoolShiftDTO>> setWeeklySchedule(
            @PathVariable String poolId,
            @RequestBody WeeklyScheduleRequest request) {
        return ResponseEntity.ok(shiftService.setWeeklySchedule(poolId, request));
    }
}
