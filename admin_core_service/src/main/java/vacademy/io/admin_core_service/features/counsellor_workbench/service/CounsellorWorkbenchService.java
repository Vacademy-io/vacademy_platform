package vacademy.io.admin_core_service.features.counsellor_workbench.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolMember;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolMemberRepository;
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
    private final CounselorPoolMemberRepository counselorPoolMemberRepository;
    private final LeadWorkbenchSettingService settingService;
    private final AuthService authService;

    // ────────────────────────────────────────────────────────────────
    // /me
    // ────────────────────────────────────────────────────────────────

    public WorkbenchTeamDTO myTeam(String instituteId, CustomUserDetails caller) {
        return scopeService.resolveHomeScope(instituteId, caller.getUserId());
    }

    public Page<WorkbenchLeadDTO> myLeads(String instituteId, CustomUserDetails caller,
                                          String conversionStatus, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        // RBAC: caller + descendants via parent_user_id. A team head gets
        // their whole downstream; a leaf member gets only their own leads.
        List<String> users = scopeService.descendantUserIdsForCaller(instituteId, caller.getUserId());
        if (users.isEmpty()) return Page.empty(pageable);
        long total = leadRepo.countLeadsForCounsellors(instituteId, users, conversionStatus);
        if (total == 0) return new PageImpl<>(List.of(), pageable, 0);
        List<WorkbenchLeadDTO> content = hydrateLeadIdentities(
                leadRepo.findLeadsForCounsellors(instituteId, users, conversionStatus,
                        (int) pageable.getOffset(), pageable.getPageSize()));
        return new PageImpl<>(content, pageable, total);
    }

    /**
     * Per-counsellor leads list (admin / manager path). The /me/leads
     * variant is auth-scoped to the caller; this one accepts an explicit
     * user_id so a CSO can drill into anyone in the team subtree.
     */
    public Page<WorkbenchLeadDTO> leadsForCounsellor(String instituteId, String counsellorUserId,
                                                     String conversionStatus, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        List<String> ids = Collections.singletonList(counsellorUserId);
        long total = leadRepo.countLeadsForCounsellors(instituteId, ids, conversionStatus);
        if (total == 0) return new PageImpl<>(List.of(), pageable, 0);
        List<WorkbenchLeadDTO> content = hydrateLeadIdentities(leadRepo.findLeadsForCounsellors(
                instituteId, ids, conversionStatus,
                (int) pageable.getOffset(), pageable.getPageSize()));
        return new PageImpl<>(content, pageable, total);
    }

    /**
     * Lead identity (name / email / phone) lives in auth_service's `users`
     * table. Admin-core and auth-service run on separate Postgres databases
     * on stage/prod, so admin-core CANNOT join to `users` directly — the SQL
     * fails with "relation users does not exist". Same cross-service
     * hydration pattern as AudienceService.mapResponsesToLeadDetails: one
     * batch HTTP call per response page, then attach name/email/phone in
     * the service layer.
     */
    private List<WorkbenchLeadDTO> hydrateLeadIdentities(List<WorkbenchLeadDTO> leads) {
        if (leads == null || leads.isEmpty()) return leads;
        List<String> userIds = leads.stream()
                .map(WorkbenchLeadDTO::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        if (userIds.isEmpty()) return leads;
        Map<String, UserDTO> userById;
        try {
            userById = authService.getUsersFromAuthServiceByUserIds(userIds).stream()
                    .filter(Objects::nonNull)
                    .filter(u -> u.getId() != null)
                    .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));
        } catch (Exception e) {
            // Auth-service degradation must NOT 500 the workbench. Log and
            // return the rows with name/email/phone left null — the UI
            // already renders a user_id fallback for missing names.
            log.warn("Lead identity hydration failed: {}", e.getMessage());
            return leads;
        }
        for (WorkbenchLeadDTO lead : leads) {
            UserDTO u = userById.get(lead.getUserId());
            if (u == null) continue;
            lead.setLeadName(u.getFullName());
            lead.setLeadEmail(u.getEmail());
            lead.setLeadPhone(u.getMobileNumber());
        }
        return leads;
    }

    // ────────────────────────────────────────────────────────────────
    // Counsellor list
    // ────────────────────────────────────────────────────────────────

    /**
     * Build the workbench roster for a team subtree, intersected with the
     * caller's RBAC scope (their user-to-user descendants). A team head
     * sees their whole downstream; a manager sees their reports; a leaf
     * counsellor sees only themselves. Pass {@code caller=null} to bypass
     * the RBAC filter (admin / scheduled-job paths).
     *
     * Server-side paginated. Search and status filters are applied to the
     * resolved user set before slicing so the page count stays meaningful
     * (no "page 2 of 5 is empty" UX). Per-row aggregations (team mapping,
     * open-lead count) only run for the visible slice, keeping the cost
     * roughly proportional to `size`, not the team's total counsellor count.
     */
    public Page<WorkbenchCounsellorDTO> listCounsellorsForTeam(String instituteId, String teamId,
                                                               String search, String statusFilter,
                                                               int page, int size,
                                                               CustomUserDetails caller) {
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));

        // Resolve the team subtree once via auth_service. When teamId is
        // omitted, fall back to "everything under the institute's leads root".
        List<OrgTeamDTO> subtree = (teamId != null && !teamId.isBlank())
                ? orgTeamClient.getSubtreeIncludingSelf(teamId)
                : scopeService.leadsRootSubtree(instituteId);
        if (subtree.isEmpty()) return Page.empty(pageable);
        Map<String, String> teamNameById = subtree.stream()
                .collect(Collectors.toMap(OrgTeamDTO::getId, OrgTeamDTO::getName, (a, b) -> a));

        // Pull membership rows for the subtree from auth_service. The endpoint
        // returns DISTINCT user ids; we walk per-user to recover their primary
        // (most-recent) team mapping for display purposes.
        List<String> userIds = orgTeamClient.usersInTeams(new ArrayList<>(teamNameById.keySet()));
        if (userIds.isEmpty()) return Page.empty(pageable);

        // RBAC: every caller (including root admins) sees only themselves +
        // their downstream in the team hierarchy. A root admin who isn't
        // mapped into the leads team subtree sees only themselves; if they
        // need the whole team view, they should be added to the team's
        // root mapping via Manage Institute → Teams. The caller=null path
        // (scheduled jobs, admin-internal flows) still gets the unfiltered
        // view.
        if (caller != null) {
            Set<String> allowed = new HashSet<>(
                    scopeService.descendantUserIdsForCaller(instituteId, caller.getUserId()));
            userIds = userIds.stream().filter(allowed::contains).toList();
            if (userIds.isEmpty()) return Page.empty(pageable);
        }

        // Resolve names in one batch — needed BEFORE filtering so search can
        // match against name/email.
        Map<String, UserDTO> userById = new HashMap<>();
        try {
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(userIds))) {
                if (u != null && u.getId() != null) userById.put(u.getId(), u);
            }
        } catch (Exception e) {
            log.warn("Auth-service name lookup failed for {} ids: {}", userIds.size(), e.getMessage());
        }

        // "Active" in the workbench = has ANY ACTIVE row across all their
        // pool memberships. One batched query for all counsellors instead of
        // N calls to listActiveMembershipsForCounselor (which also applied
        // an allMatch-per-pool rollup intended for the "mark inactive" UI,
        // and falsely demoted counsellors who were paused on just one
        // audience to fully inactive here).
        Set<String> activeCounsellorIds = new HashSet<>(
                counselorPoolMemberRepository.findCounselorsWithAnyActiveMembership(instituteId, userIds));

        // Apply filters BEFORE pagination. Search matches full_name OR email,
        // case-insensitive substring. Status filter matches the boolean
        // is_active derived above.
        String searchLower = (search != null && !search.isBlank()) ? search.toLowerCase(Locale.ROOT).trim() : null;
        boolean wantActive = "active".equalsIgnoreCase(statusFilter);
        boolean wantInactive = "inactive".equalsIgnoreCase(statusFilter);
        List<String> filteredIds = userIds.stream()
                .filter(uid -> {
                    if (wantActive && !activeCounsellorIds.contains(uid)) return false;
                    if (wantInactive && activeCounsellorIds.contains(uid)) return false;
                    if (searchLower == null) return true;
                    UserDTO u = userById.get(uid);
                    if (u == null) return false;
                    String name = u.getFullName() != null ? u.getFullName().toLowerCase(Locale.ROOT) : "";
                    String email = u.getEmail() != null ? u.getEmail().toLowerCase(Locale.ROOT) : "";
                    return name.contains(searchLower) || email.contains(searchLower);
                })
                // Stable sort by name (then user_id) so pagination is consistent
                // across page navigations on the same filter snapshot.
                .sorted(Comparator
                        .<String, String>comparing(uid -> {
                            UserDTO u = userById.get(uid);
                            return u != null && u.getFullName() != null
                                    ? u.getFullName().toLowerCase(Locale.ROOT)
                                    : "~"; // unnamed users sink to the bottom
                        })
                        .thenComparing(uid -> uid))
                .toList();

        long total = filteredIds.size();
        int from = Math.min((int) pageable.getOffset(), filteredIds.size());
        int to = Math.min(from + pageable.getPageSize(), filteredIds.size());
        List<String> pageIds = filteredIds.subList(from, to);
        if (pageIds.isEmpty()) return new PageImpl<>(List.of(), pageable, total);

        // Per-row aggregations only for the visible slice — keeps the cost of
        // a typical page proportional to `size`, not the whole roster.
        Map<String, RatingDTO> ratingById = settingService.getCounsellorRatingsBatch(instituteId, pageIds);

        List<WorkbenchCounsellorDTO> content = new ArrayList<>(pageIds.size());
        for (String uid : pageIds) {
            UserDTO u = userById.get(uid);
            RatingDTO r = ratingById.get(uid);
            TeamMemberDTO primary = orgTeamClient.mappingsForUser(uid).stream()
                    .filter(m -> teamNameById.containsKey(m.getTeamId()))
                    .findFirst().orElse(null);
            boolean isActive = activeCounsellorIds.contains(uid);
            long openLeads = leadRepo.countOpenLeadsForCounsellor(instituteId, uid);
            content.add(WorkbenchCounsellorDTO.builder()
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
        return new PageImpl<>(content, pageable, total);
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
            // Canonical "open" filter (NULL or != CONVERTED). The old
            // hard-coded conversion_status = 'LEAD' didn't match the bulk of
            // real data where the column is NULL until the first status
            // change, so the reassign dialog never opened.
            openLeads = hydrateLeadIdentities(
                    leadRepo.findOpenLeadsForCounsellor(instituteId, userId, 0, 200));
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
