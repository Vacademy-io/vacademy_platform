package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.auth_service.service.OrganizationTeamAuthClient;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.ActivityFeedItemDTO;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.StatusChangeResponseDTO;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchCounsellorDTO;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchLeadDTO;
import vacademy.io.admin_core_service.features.counsellor_workbench.dto.WorkbenchTeamDTO;
import vacademy.io.admin_core_service.features.counsellor_workbench.repository.WorkbenchActivityRepository;
import vacademy.io.admin_core_service.features.counsellor_workbench.repository.WorkbenchLeadRepository;
import vacademy.io.admin_core_service.features.counselor_pool.dto.CounselorPoolMembershipDTO;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolMember;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolMemberRepository;
import vacademy.io.admin_core_service.features.counselor_pool.service.CounselorPoolService;
import vacademy.io.admin_core_service.features.counsellor_rating.dto.RatingDTO;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.organization.OrgTeamDTO;
import vacademy.io.common.auth.dto.organization.TeamMemberDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Top-level facade for /counsellor-workbench/*. Composes the scope service,
 * the lead/activity repositories, and the existing counselor pool service so
 * one HTTP endpoint maps cleanly to one service call.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CounsellorWorkbenchService {

    private final CounsellorScopeService scopeService;
    private final WorkbenchLeadRepository leadRepo;
    private final WorkbenchActivityRepository activityRepo;
    private final OrganizationTeamAuthClient orgTeamClient;
    private final CounselorPoolService counselorPoolService;
    private final CounselorPoolMemberRepository counselorPoolMemberRepository;
    private final LeadWorkbenchSettingService settingService;
    private final AuthService authService;

    // ────────────────────────────────────────────────────────────────
    // /me
    // ────────────────────────────────────────────────────────────────

    public WorkbenchTeamDTO myTeam(String instituteId, CustomUserDetails caller) {
        return scopeService.resolveHomeScope(instituteId, caller.getUserId());
    }

    public List<WorkbenchLeadDTO> myLeads(String instituteId, CustomUserDetails caller,
                                          String conversionStatus, int page, int size) {
        WorkbenchTeamDTO scope = scopeService.resolveHomeScope(instituteId, caller.getUserId());
        List<String> users = scopeService.usersInTeams(scope.getDescendantTeamIds());
        if (users.isEmpty()) return Collections.emptyList();
        return leadRepo.findLeadsForCounsellors(instituteId, users, conversionStatus, page * size, size);
    }

    // ────────────────────────────────────────────────────────────────
    // Counsellor list
    // ────────────────────────────────────────────────────────────────

    /**
     * Build the workbench left-rail roster for a team subtree.
     * Active flag is derived from the existing counselor_pool memberships:
     * a counsellor is "active" iff they have at least one ACTIVE pool row.
     */
    public List<WorkbenchCounsellorDTO> listCounsellorsForTeam(String instituteId, String teamId) {
        // Resolve the team subtree once via auth_service. When teamId is
        // omitted, fall back to "everything under the institute's leads root".
        List<OrgTeamDTO> subtree = (teamId != null && !teamId.isBlank())
                ? orgTeamClient.getSubtreeIncludingSelf(teamId)
                : scopeService.leadsRootSubtree(instituteId);
        if (subtree.isEmpty()) return Collections.emptyList();
        Map<String, String> teamNameById = subtree.stream()
                .collect(Collectors.toMap(OrgTeamDTO::getId, OrgTeamDTO::getName, (a, b) -> a));

        // Pull membership rows for the subtree from auth_service. The endpoint
        // returns DISTINCT user ids; we walk per-user to recover their primary
        // (most-recent) team mapping for display purposes.
        List<String> userIds = orgTeamClient.usersInTeams(new ArrayList<>(teamNameById.keySet()));
        if (userIds.isEmpty()) return Collections.emptyList();

        // Resolve names in one batch.
        Map<String, UserDTO> userById = new HashMap<>();
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds))) {
                if (u != null && u.getId() != null) userById.put(u.getId(), u);
            }
        } catch (Exception e) {
            log.warn("Auth-service name lookup failed for {} ids: {}", userIds.size(), e.getMessage());
        }

        // Resolve ratings from the same institute_setting JSON that holds
        // the strategy config. One read returns every rated counsellor;
        // unrated ones are surfaced as nulls below.
        Map<String, RatingDTO> ratingById = settingService.getCounsellorRatingsBatch(instituteId, userIds);

        List<WorkbenchCounsellorDTO> out = new ArrayList<>(userIds.size());
        for (String uid : userIds) {
            UserDTO u = userById.get(uid);
            RatingDTO r = ratingById.get(uid);
            // Pick this user's first mapping within the subtree for display
            // (team name + role label). Cheap: one HMAC call per user.
            TeamMemberDTO primary = orgTeamClient.mappingsForUser(uid).stream()
                    .filter(m -> teamNameById.containsKey(m.getTeamId()))
                    .findFirst().orElse(null);
            // "Active" rolls up to ANY active pool membership in this institute.
            boolean isActive = counselorPoolService
                    .listActiveMembershipsForCounselor(instituteId, uid).stream()
                    .anyMatch(this::isPoolActive);
            long openLeads = leadRepo.countOpenLeadsForCounsellor(instituteId, uid);
            out.add(WorkbenchCounsellorDTO.builder()
                    .userId(uid)
                    .fullName(u != null ? u.getFullName() : null)
                    .email(u != null ? u.getEmail() : null)
                    .teamId(primary != null ? primary.getTeamId() : null)
                    .teamName(primary != null ? teamNameById.get(primary.getTeamId()) : null)
                    .roleLabel(primary != null ? primary.getRoleLabel() : null)
                    .isActive(isActive)
                    .openLeadsCount(openLeads)
                    .rating(r != null ? r.getScore() : null)
                    .ratingStrategyType(r != null ? r.getStrategyType() : null)
                    .build());
        }
        return out;
    }

    private boolean isPoolActive(CounselorPoolMembershipDTO m) {
        return m.getStatus() != null && m.getStatus().equalsIgnoreCase("ACTIVE");
    }

    // ────────────────────────────────────────────────────────────────
    // Status flip — org-wide via the existing pool API
    // ────────────────────────────────────────────────────────────────

    /**
     * Flip a counsellor's status across every pool they're in for this
     * institute. The existing CounselorPoolService.bulkUpdateMemberStatusAcrossPools
     * already does the per-pool work (including timeline_event writes when
     * leads are reassigned to backups), so we reuse it here rather than
     * duplicating the logic. When status=INACTIVE, callers can immediately
     * follow with /reassign to redirect the open leads — backupCounselorUserId
     * is not required at this layer (workbench's reassign flow handles it).
     */
    @Transactional
    public StatusChangeResponseDTO setStatus(String instituteId, String userId, String status,
                                             CustomUserDetails actor) {
        if (!"ACTIVE".equalsIgnoreCase(status) && !"INACTIVE".equalsIgnoreCase(status)) {
            throw new IllegalArgumentException("status must be ACTIVE or INACTIVE");
        }
        // Directly flip every pool_member row for this counsellor across the
        // institute. We bypass CounselorPoolService.bulkUpdateMemberStatusAcrossPools
        // intentionally — that path requires a backup_counselor_user_id when
        // marking INACTIVE because it tries to reassign leads to the backup
        // inline. The workbench splits that: status flip is fast and atomic
        // here, then the caller's UI runs /reassign separately (SINGLE,
        // ROUND_ROBIN, or MANUAL preview). Open leads are returned in the
        // response so the dialog can pre-populate.
        List<CounselorPoolMember> rows = counselorPoolMemberRepository
                .findByInstituteAndCounselor(instituteId, userId);
        Set<String> affectedPoolIds = new HashSet<>();
        String upper = status.toUpperCase(Locale.ROOT);
        for (CounselorPoolMember m : rows) {
            m.setStatus(upper);
            // Clear stale backup pointers when going back to ACTIVE.
            if ("ACTIVE".equals(upper)) m.setBackupCounselorUserId(null);
            affectedPoolIds.add(m.getPoolId());
        }
        counselorPoolMemberRepository.saveAll(rows);
        int poolsAffected = affectedPoolIds.size();

        List<WorkbenchLeadDTO> openLeads = Collections.emptyList();
        if ("INACTIVE".equalsIgnoreCase(status)) {
            openLeads = leadRepo.findLeadsForCounsellors(
                    instituteId, Collections.singletonList(userId), "LEAD", 0, 200);
        }
        return StatusChangeResponseDTO.builder()
                .userId(userId)
                .status(status)
                .poolsAffected(poolsAffected)
                .openLeads(openLeads)
                .build();
    }

    // ────────────────────────────────────────────────────────────────
    // Activity feed
    // ────────────────────────────────────────────────────────────────

    public List<ActivityFeedItemDTO> activityFeed(String counsellorUserId, String instituteId,
                                                  Timestamp from, Timestamp to, int limit) {
        if (from == null) from = new Timestamp(System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000);
        if (to == null) to = new Timestamp(System.currentTimeMillis() + 60_000); // small future buffer
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return activityRepo.fetchFeed(counsellorUserId, instituteId, from, to, safeLimit);
    }
}
