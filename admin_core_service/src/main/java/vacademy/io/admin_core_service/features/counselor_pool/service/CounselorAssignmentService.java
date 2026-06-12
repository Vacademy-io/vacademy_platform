package vacademy.io.admin_core_service.features.counselor_pool.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.service.LeadAssignmentNotifier;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPool;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolAudience;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolMember;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShift;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShiftMember;
import vacademy.io.admin_core_service.features.counselor_pool.enums.AssignmentMode;
import vacademy.io.admin_core_service.features.counselor_pool.enums.PoolStatus;
import vacademy.io.admin_core_service.features.counselor_pool.enums.ShiftDayOfWeek;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolAudienceRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolMemberRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolShiftMemberRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolShiftRepository;
import vacademy.io.admin_core_service.features.notification_service.service.NotificationService;

import java.sql.Time;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

/**
 * The routing engine. Given an audience that just received a lead, decide
 * which counselor (if any) gets it. Runs synchronously in the caller's
 * request thread so the assigned counselor is visible immediately when the
 * lead-submit response returns.
 *
 * Implements the algorithm from .samar/documentation/counselor_pool_design.md
 * section 8:
 *   1. Resolve pool from audience
 *   2. Switch on mode (MANUAL leaves it unassigned)
 *   3. Build candidate counselor set
 *      - ROUND_ROBIN: ordered pool members for the audience
 *      - TIME_BASED:  shift members covering now, intersected with pool members
 *   4. Acquire pessimistic lock on counselor_pool_audience
 *   5. Pick next via last_assigned_counselor_id + display_order
 *   6. Apply backup if picked is INACTIVE
 *   7. Persist pointer update
 *
 * The resolved counselor user_id is returned to the caller, who is
 * responsible for writing it onto user_lead_profile.assigned_counselor_id.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounselorAssignmentService {

    /** v1: institute timezone is hardcoded. Move to institutes.timezone when multi-region support is added. */
    private static final ZoneId INSTITUTE_TIMEZONE = ZoneId.of("Asia/Kolkata");

    private final CounselorPoolRepository poolRepository;
    private final CounselorPoolAudienceRepository poolAudienceRepository;
    private final CounselorPoolMemberRepository poolMemberRepository;
    private final CounselorPoolShiftRepository shiftRepository;
    private final CounselorPoolShiftMemberRepository shiftMemberRepository;
    private final AudienceRepository audienceRepository;        // for resolving campaign name in alert text
    private final NotificationService notificationService;      // existing helper that wraps notification_service HTTP call
    private final LeadAssignmentNotifier leadAssignmentNotifier; // shared bell-alert sender for ALL assignment paths

    /**
     * Pick a counselor for a lead that just arrived on the given audience.
     *
     * @return the resolved counselor user_id (after backup redirection if any),
     *         or Optional.empty() if the audience has no pool, the pool is
     *         MANUAL, no eligible counselor was found, or any other reason
     *         routing should be skipped.
     */
    @Transactional
    public Optional<String> assignCounselorForLead(String audienceId) {
        // Step 1: resolve the pool
        Optional<CounselorPoolAudience> poolAudienceOpt = poolAudienceRepository.findByAudienceId(audienceId);
        if (poolAudienceOpt.isEmpty()) {
            return Optional.empty(); // Audience isn't in any pool — nothing to do.
        }
        String poolId = poolAudienceOpt.get().getPoolId();

        CounselorPool pool = poolRepository.findById(poolId).orElse(null);
        if (pool == null) {
            log.warn("Pool referenced by counselor_pool_audience does not exist: poolId={}", poolId);
            return Optional.empty();
        }

        // Step 2: check the pool's mode
        AssignmentMode mode;
        try {
            mode = AssignmentMode.valueOf(pool.getAssignmentMode());
        } catch (IllegalArgumentException e) {
            log.warn("Unknown assignment_mode '{}' on pool {}", pool.getAssignmentMode(), poolId);
            return Optional.empty();
        }
        if (mode == AssignmentMode.MANUAL) {
            return Optional.empty();
        }

        // Step 3: build candidate set (ordered)
        List<CounselorPoolMember> orderedMembers = buildCandidateMembers(pool, audienceId, mode);
        if (orderedMembers.isEmpty()) {
            log.info("No candidate counselors for audience={} in pool={}", audienceId, poolId);
            sendUnassignedAlertToPoolAdmin(pool, audienceId);
            return Optional.empty();
        }

        // Step 4: pessimistic lock on the audience row (serializes concurrent assignments for same audience)
        CounselorPoolAudience locked = poolAudienceRepository.findByAudienceIdForUpdate(audienceId)
                .orElse(null);
        if (locked == null) {
            // Race: audience was removed between resolution and lock. Bail (transient — no alert).
            return Optional.empty();
        }

        // Step 5: pick the next member by rotation
        CounselorPoolMember picked = pickNext(orderedMembers, locked.getLastAssignedCounselorId());

        // Step 6: resolve backup if picked is INACTIVE.
        // Backup chain is NOT followed in v1: if the backup is also inactive, we fall through to the next eligible.
        ResolvedAssignment resolved = resolveWithBackup(picked, orderedMembers, locked.getLastAssignedCounselorId());
        if (resolved == null) {
            log.info("All candidates inactive (no usable backup) for audience={} pool={}", audienceId, poolId);
            sendUnassignedAlertToPoolAdmin(pool, audienceId);
            return Optional.empty();
        }

        // Step 7: persist pointer. Track the ORIGINAL picked user (not the backup) so rotation continues
        // normally when the original becomes active again.
        poolAudienceRepository.updateLastAssigned(
                locked.getId(),
                resolved.pickedOriginalUserId,
                new Timestamp(System.currentTimeMillis()));

        // Step 8: bell-icon notification to the assigned counselor.
        sendNewLeadNotificationToCounsellor(pool, audienceId, resolved.resolvedUserId);

        return Optional.of(resolved.resolvedUserId);
    }

    // ────────────────────────────────────────────────────────────────
    // System alert dispatch (best-effort; failures don't break assignment)
    // ────────────────────────────────────────────────────────────────

    /**
     * Bell-icon notification for a counselor who just got a new lead.
     * Delegates to {@link LeadAssignmentNotifier} — the shared sender used by
     * every assignment path (manual, bulk import, reassign, backup) — with
     * the exact text/settings this method historically produced.
     */
    private void sendNewLeadNotificationToCounsellor(CounselorPool pool, String audienceId, String counselorUserId) {
        if (counselorUserId == null || counselorUserId.isBlank()) {
            return;
        }
        leadAssignmentNotifier.notifyAssigned(
                pool.getInstituteId(), counselorUserId, null, resolveCampaignName(audienceId));
    }

    /**
     * Alert the pool's creator that a lead which SHOULD have been auto-assigned
     * (mode != MANUAL) could not be routed. Lead is unassigned; admin needs to
     * either fix counselor configuration or assign manually.
     */
    private void sendUnassignedAlertToPoolAdmin(CounselorPool pool, String audienceId) {
        String adminUserId = pool.getCreatedBy();
        if (adminUserId == null || adminUserId.isBlank()) {
            log.warn("Pool {} has no created_by; cannot route unassigned-lead alert", pool.getId());
            return;
        }
        String campaignName = resolveCampaignName(audienceId);
        try {
            notificationService.createSystemAlertAnnouncement(
                    pool.getInstituteId(),
                    List.of(adminUserId),
                    "Lead could not be auto-assigned",
                    "A lead in pool \"" + pool.getName() + "\" (campaign: " + campaignName + ") could not be auto-assigned. "
                            + "Either all counselors are inactive, or the audience has no members. Please assign manually.",
                    "system",
                    "System",
                    "ADMIN",
                    Map.of(
                            "priority", 3,
                            "isDismissible", true,
                            "showBadge", true,
                            "isActive", true
                    )
            );
        } catch (Exception e) {
            log.warn("Failed to send unassigned-lead alert to admin={} for pool={}: {}",
                    adminUserId, pool.getId(), e.getMessage());
        }
    }

    private String resolveCampaignName(String audienceId) {
        return audienceRepository.findById(audienceId)
                .map(Audience::getCampaignName)
                .filter(name -> name != null && !name.isBlank())
                .orElse("Untitled campaign");
    }

    // ────────────────────────────────────────────────────────────────
    // Candidate set construction
    // ────────────────────────────────────────────────────────────────

    private List<CounselorPoolMember> buildCandidateMembers(CounselorPool pool, String audienceId, AssignmentMode mode) {
        List<CounselorPoolMember> allMembers = poolMemberRepository
                .findByPoolIdAndAudienceIdOrderByDisplayOrderAsc(pool.getId(), audienceId);

        if (mode == AssignmentMode.ROUND_ROBIN) {
            return allMembers;
        }

        // TIME_BASED: filter to counselors currently on shift
        LocalDateTime nowInInstituteTz = LocalDateTime.now(INSTITUTE_TIMEZONE);
        String todayDayOfWeek = ShiftDayOfWeek.fromJavaDay(nowInInstituteTz.getDayOfWeek()).name();
        Time nowTime = Time.valueOf(nowInInstituteTz.toLocalTime().withNano(0));

        List<CounselorPoolShift> activeShifts = shiftRepository.findActiveShiftsForPoolAtTime(
                pool.getId(), todayDayOfWeek, nowTime);
        if (activeShifts.isEmpty()) {
            return List.of();
        }

        List<String> shiftIds = activeShifts.stream().map(CounselorPoolShift::getId).toList();
        Set<String> onShiftUserIds = shiftMemberRepository.findActiveMembersInShifts(shiftIds).stream()
                .map(CounselorPoolShiftMember::getCounselorUserId)
                .collect(Collectors.toSet());

        return allMembers.stream()
                .filter(m -> onShiftUserIds.contains(m.getCounselorUserId()))
                .toList();
    }

    // ────────────────────────────────────────────────────────────────
    // Pointer-based rotation
    // ────────────────────────────────────────────────────────────────

    /**
     * Pick the next counselor based on display_order and the last-assigned pointer.
     * Returns the first member whose display_order is strictly greater than the
     * last-assigned member's order. Wraps to the first (lowest order) if no
     * such member exists, or if the pointer is unknown or no longer in the list.
     */
    private CounselorPoolMember pickNext(List<CounselorPoolMember> orderedMembers, String lastAssignedUserId) {
        if (lastAssignedUserId == null) {
            return orderedMembers.get(0);
        }
        Integer lastOrder = orderedMembers.stream()
                .filter(m -> lastAssignedUserId.equals(m.getCounselorUserId()))
                .map(CounselorPoolMember::getDisplayOrder)
                .findFirst()
                .orElse(null);
        if (lastOrder == null) {
            // Pointer points to someone no longer in the candidate set (removed or not on shift). Restart.
            return orderedMembers.get(0);
        }
        for (CounselorPoolMember m : orderedMembers) {
            if (m.getDisplayOrder() > lastOrder) {
                return m;
            }
        }
        return orderedMembers.get(0); // wrap
    }

    // ────────────────────────────────────────────────────────────────
    // Backup resolution
    // ────────────────────────────────────────────────────────────────

    private ResolvedAssignment resolveWithBackup(CounselorPoolMember firstPick,
                                                 List<CounselorPoolMember> orderedMembers,
                                                 String lastAssignedUserId) {
        CounselorPoolMember cursor = firstPick;
        Set<String> visited = new HashSet<>();
        while (cursor != null && !visited.contains(cursor.getCounselorUserId())) {
            visited.add(cursor.getCounselorUserId());

            if (PoolStatus.ACTIVE.name().equals(cursor.getStatus())) {
                return new ResolvedAssignment(firstPick.getCounselorUserId(), cursor.getCounselorUserId());
            }

            // INACTIVE — check backup (one level only, per design v1).
            // Backups can be ANY institute counsellor, not necessarily a member of
            // this pool. If the backup is also a pool member, only redirect when
            // they're active; otherwise (non-pool-member backup) we trust the id
            // and route to them directly — the frontend dropdown only offered
            // valid candidates at the moment the admin saved.
            String backupId = cursor.getBackupCounselorUserId();
            if (backupId != null && !backupId.isBlank()) {
                CounselorPoolMember backupMember = orderedMembers.stream()
                        .filter(m -> backupId.equals(m.getCounselorUserId()))
                        .findFirst()
                        .orElse(null);
                boolean backupUsable = backupMember == null
                        || PoolStatus.ACTIVE.name().equals(backupMember.getStatus());
                if (backupUsable) {
                    return new ResolvedAssignment(firstPick.getCounselorUserId(), backupId);
                }
                // Backup is in pool but inactive → fall through to next eligible.
            }

            // Advance to the next member in rotation (skip the inactive one and look for someone active).
            cursor = pickNext(orderedMembers, cursor.getCounselorUserId());
            // Stop if we've wrapped back to the original first pick.
            if (cursor.getCounselorUserId().equals(firstPick.getCounselorUserId())) {
                break;
            }
        }
        return null; // Everyone in scope is inactive without usable backups.
    }

    /** Internal carrier for the pair (who-we-picked-in-rotation, who-actually-gets-it). */
    private record ResolvedAssignment(String pickedOriginalUserId, String resolvedUserId) {}
}
