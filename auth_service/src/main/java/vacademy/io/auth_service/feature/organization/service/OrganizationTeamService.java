package vacademy.io.auth_service.feature.organization.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.organization.entity.OrganizationTeam;
import vacademy.io.auth_service.feature.organization.entity.UserOrganizationTeamMapping;
import vacademy.io.auth_service.feature.organization.repository.OrganizationTeamRepository;
import vacademy.io.auth_service.feature.organization.repository.UserOrganizationTeamMappingRepository;
import vacademy.io.common.auth.dto.organization.*;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Hybrid org-chart service:
 *   - {@code organization_team} stores flat teams (no sub-teams).
 *   - {@code user_organization_team_mapping} stores one row per (team, user)
 *     PLUS a {@code parent_user_id} captured per row. parent_user_id forms
 *     a user-to-user reporting tree inside each team.
 *
 * A single user can have many mapping rows (multi-team membership) and
 * potentially a different parent_user_id in each team. Removing a user
 * from a team promotes their direct reports in that team to roots (null
 * parent), so nobody disappears from the chart.
 */
@Service
@RequiredArgsConstructor
public class OrganizationTeamService {

    private final OrganizationTeamRepository teamRepo;
    private final UserOrganizationTeamMappingRepository mappingRepo;

    // ────────────────────────────────────────────────────────────────
    // Teams
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public OrgTeamDTO createTeam(CreateTeamRequest req, String createdBy) {
        require(req.getInstituteId(), "institute_id is required");
        require(req.getName(), "name is required");
        OrganizationTeam t = OrganizationTeam.builder()
                .instituteId(req.getInstituteId())
                .name(req.getName().trim())
                .description(req.getDescription())
                .status("ACTIVE")
                .sortOrder(0)
                .createdBy(createdBy)
                .build();
        return toTeamDTO(teamRepo.save(t), 0L);
    }

    @Transactional
    public OrgTeamDTO updateTeam(String teamId, UpdateTeamRequest req) {
        OrganizationTeam t = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        if (req.getName() != null && !req.getName().isBlank()) t.setName(req.getName().trim());
        if (req.getDescription() != null) t.setDescription(req.getDescription());
        return toTeamDTO(teamRepo.save(t), mappingRepo.countActiveByTeam(t.getId()));
    }

    @Transactional
    public void deleteTeam(String teamId) {
        OrganizationTeam t = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        // Soft-delete the team and all its memberships. People's memberships
        // in OTHER teams are unaffected.
        List<UserOrganizationTeamMapping> memberships = mappingRepo.findActiveByTeam(teamId);
        for (UserOrganizationTeamMapping m : memberships) {
            m.setStatus("INACTIVE");
            mappingRepo.save(m);
        }
        t.setStatus("INACTIVE");
        teamRepo.save(t);
    }

    public List<OrgTeamDTO> listTeams(String instituteId) {
        return teamRepo.findAllActive(instituteId).stream()
                .map(t -> toTeamDTO(t, mappingRepo.countActiveByTeam(t.getId())))
                .collect(Collectors.toList());
    }

    public OrgTeamDTO getTeam(String teamId) {
        OrganizationTeam t = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        return toTeamDTO(t, mappingRepo.countActiveByTeam(t.getId()));
    }

    // ────────────────────────────────────────────────────────────────
    // Members (per-team reporting tree)
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public TeamMemberDTO addMember(String teamId, AddMemberRequest req, String addedBy) {
        OrganizationTeam team = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        require(req.getUserId(), "user_id is required");
        if (mappingRepo.findActiveByTeamAndUser(teamId, req.getUserId()).isPresent()) {
            throw new VacademyException("This person is already in this team");
        }
        // Validate parent_user_id is in the same team (when given).
        if (req.getParentUserId() != null) {
            if (req.getParentUserId().equals(req.getUserId())) {
                throw new VacademyException("A person cannot report to themselves");
            }
            if (mappingRepo.findActiveByTeamAndUser(teamId, req.getParentUserId()).isEmpty()) {
                throw new VacademyException("The chosen manager is not in this team");
            }
        }
        UserOrganizationTeamMapping m = UserOrganizationTeamMapping.builder()
                .teamId(teamId)
                .userId(req.getUserId())
                .parentUserId(req.getParentUserId())
                .roleLabel(req.getRoleLabel())
                .status("ACTIVE")
                .addedBy(addedBy)
                .build();
        return toMemberDTO(mappingRepo.save(m));
    }

    @Transactional
    public TeamMemberDTO updateMember(String teamId, String mappingId, UpdateMemberRequest req) {
        UserOrganizationTeamMapping m = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Membership not found: " + mappingId));
        if (!teamId.equals(m.getTeamId())) {
            throw new VacademyException("Membership does not belong to this team");
        }
        if (Boolean.TRUE.equals(req.getChangeParent())) {
            String newParent = req.getParentUserId();
            if (newParent != null) {
                if (newParent.equals(m.getUserId())) {
                    throw new VacademyException("A person cannot report to themselves");
                }
                if (mappingRepo.findActiveByTeamAndUser(teamId, newParent).isEmpty()) {
                    throw new VacademyException("The chosen manager is not in this team");
                }
                if (wouldCreateCycle(teamId, m.getUserId(), newParent)) {
                    throw new VacademyException("Move would create a reporting loop");
                }
            }
            m.setParentUserId(newParent);
        }
        if (Boolean.TRUE.equals(req.getChangeRoleLabel())) {
            m.setRoleLabel(req.getRoleLabel());
        }
        return toMemberDTO(mappingRepo.save(m));
    }

    @Transactional
    public void removeMember(String teamId, String mappingId) {
        UserOrganizationTeamMapping m = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Membership not found: " + mappingId));
        if (!teamId.equals(m.getTeamId())) {
            throw new VacademyException("Membership does not belong to this team");
        }
        // Promote direct reports inside this team to roots so the tree
        // stays whole. Their memberships in OTHER teams are untouched.
        mappingRepo.promoteChildrenToRoot(teamId, m.getUserId());
        m.setStatus("INACTIVE");
        mappingRepo.save(m);
    }

    public List<TeamMemberDTO> listMembers(String teamId) {
        return mappingRepo.findActiveByTeam(teamId).stream()
                .map(this::toMemberDTO).collect(Collectors.toList());
    }

    public List<TeamMemberDTO> listMembershipsForUser(String userId) {
        return mappingRepo.findActiveByUser(userId).stream()
                .map(this::toMemberDTO).collect(Collectors.toList());
    }

    // ────────────────────────────────────────────────────────────────
    // Chart + ancestors/descendants (per-team, user-to-user)
    // ────────────────────────────────────────────────────────────────

    /** Roots of the team's reporting tree (people with no manager in this team). */
    public List<OrgChartNodeDTO> getTeamChart(String teamId) {
        List<UserOrganizationTeamMapping> all = mappingRepo.findActiveByTeam(teamId);
        if (all.isEmpty()) return Collections.emptyList();
        Map<String, OrgChartNodeDTO> byUserId = new HashMap<>();
        for (UserOrganizationTeamMapping m : all) byUserId.put(m.getUserId(), toChartNode(m));
        List<OrgChartNodeDTO> roots = new ArrayList<>();
        for (OrgChartNodeDTO n : byUserId.values()) {
            if (n.getParentUserId() == null) {
                roots.add(n);
            } else {
                OrgChartNodeDTO parent = byUserId.get(n.getParentUserId());
                if (parent != null) parent.getChildren().add(n);
                else roots.add(n); // orphan: surface at root, don't drop
            }
        }
        return roots;
    }

    /**
     * Walk up the parent chain inside a team. Returns ancestors root → …
     * → immediate manager. Self is excluded.
     */
    public List<TeamMemberDTO> getAncestors(String teamId, String mappingId) {
        UserOrganizationTeamMapping start = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Membership not found: " + mappingId));
        if (!teamId.equals(start.getTeamId())) return Collections.emptyList();
        Map<String, UserOrganizationTeamMapping> byUser = mappingRepo.findActiveByTeam(teamId).stream()
                .collect(Collectors.toMap(UserOrganizationTeamMapping::getUserId, m -> m));
        List<TeamMemberDTO> chain = new ArrayList<>();
        String cursor = start.getParentUserId();
        Set<String> seen = new HashSet<>();
        while (cursor != null && !seen.contains(cursor)) {
            seen.add(cursor);
            UserOrganizationTeamMapping p = byUser.get(cursor);
            if (p == null) break;
            chain.add(0, toMemberDTO(p));
            cursor = p.getParentUserId();
        }
        return chain;
    }

    /** Walk down — everyone reporting under this person inside the team. Self excluded. */
    public List<TeamMemberDTO> getDescendants(String teamId, String mappingId) {
        UserOrganizationTeamMapping start = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Membership not found: " + mappingId));
        if (!teamId.equals(start.getTeamId())) return Collections.emptyList();
        List<UserOrganizationTeamMapping> all = mappingRepo.findActiveByTeam(teamId);
        Map<String, List<UserOrganizationTeamMapping>> byParent = new HashMap<>();
        for (UserOrganizationTeamMapping m : all) {
            byParent.computeIfAbsent(m.getParentUserId(), k -> new ArrayList<>()).add(m);
        }
        List<TeamMemberDTO> out = new ArrayList<>();
        Deque<String> stack = new ArrayDeque<>();
        stack.push(start.getUserId());
        Set<String> seen = new HashSet<>();
        while (!stack.isEmpty()) {
            String cursor = stack.pop();
            if (!seen.add(cursor)) continue;
            for (UserOrganizationTeamMapping c : byParent.getOrDefault(cursor, Collections.emptyList())) {
                out.add(toMemberDTO(c));
                stack.push(c.getUserId());
            }
        }
        return out;
    }

    // ────────────────────────────────────────────────────────────────
    // Internals
    // ────────────────────────────────────────────────────────────────

    /**
     * Cycle guard: would making {@code newParentUserId} the manager of
     * {@code userId} in {@code teamId} create a loop?
     */
    private boolean wouldCreateCycle(String teamId, String userId, String newParentUserId) {
        Map<String, UserOrganizationTeamMapping> byUser = mappingRepo.findActiveByTeam(teamId).stream()
                .collect(Collectors.toMap(UserOrganizationTeamMapping::getUserId, m -> m));
        String cursor = newParentUserId;
        Set<String> seen = new HashSet<>();
        while (cursor != null && !seen.contains(cursor)) {
            if (cursor.equals(userId)) return true;
            seen.add(cursor);
            UserOrganizationTeamMapping p = byUser.get(cursor);
            cursor = p == null ? null : p.getParentUserId();
        }
        return false;
    }

    private OrgTeamDTO toTeamDTO(OrganizationTeam t, long memberCount) {
        return OrgTeamDTO.builder()
                .id(t.getId())
                .instituteId(t.getInstituteId())
                .name(t.getName())
                .description(t.getDescription())
                .status(t.getStatus())
                .memberCount(memberCount)
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private TeamMemberDTO toMemberDTO(UserOrganizationTeamMapping m) {
        return TeamMemberDTO.builder()
                .mappingId(m.getId())
                .teamId(m.getTeamId())
                .userId(m.getUserId())
                .parentUserId(m.getParentUserId())
                .roleLabel(m.getRoleLabel())
                .status(m.getStatus())
                .addedAt(m.getAddedAt())
                .build();
    }

    private OrgChartNodeDTO toChartNode(UserOrganizationTeamMapping m) {
        return OrgChartNodeDTO.builder()
                .mappingId(m.getId())
                .teamId(m.getTeamId())
                .userId(m.getUserId())
                .parentUserId(m.getParentUserId())
                .roleLabel(m.getRoleLabel())
                .children(new ArrayList<>())
                .build();
    }

    private static void require(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
    }
}
