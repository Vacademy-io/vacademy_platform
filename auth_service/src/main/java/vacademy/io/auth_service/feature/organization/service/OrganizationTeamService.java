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
 * Source-of-truth service for organization teams + memberships. Lives in
 * auth_service because team membership is a property of the user.
 *
 * admin_core_service consumes these operations via HMAC-internal HTTP
 * endpoints (see OrganizationTeamInternalController).
 */
@Service
@RequiredArgsConstructor
public class OrganizationTeamService {

    private static final String STUDENT_ROLE = "STUDENT";

    private final OrganizationTeamRepository teamRepo;
    private final UserOrganizationTeamMappingRepository mappingRepo;
    private final OrganizationTeamHierarchyService hierarchyService;

    // ────────────────────────────────────────────────────────────────
    // Team CRUD
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public OrgTeamDTO createTeam(CreateTeamRequest req, String createdBy) {
        if (req.getInstituteId() == null || req.getInstituteId().isBlank()) {
            throw new VacademyException("institute_id is required");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            throw new VacademyException("name is required");
        }
        if (req.getParentId() != null) {
            OrganizationTeam parent = teamRepo.findById(req.getParentId())
                    .orElseThrow(() -> new VacademyException("Parent team not found: " + req.getParentId()));
            if (!parent.getInstituteId().equals(req.getInstituteId())) {
                throw new VacademyException("Parent team belongs to a different institute");
            }
        }
        OrganizationTeam t = OrganizationTeam.builder()
                .instituteId(req.getInstituteId())
                .parentId(req.getParentId())
                .name(req.getName().trim())
                .description(req.getDescription())
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0)
                .status("ACTIVE")
                .createdBy(createdBy)
                .build();
        return toDTO(teamRepo.save(t), 0L);
    }

    @Transactional
    public OrgTeamDTO updateTeam(String teamId, UpdateTeamRequest req) {
        OrganizationTeam t = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        if (req.getName() != null && !req.getName().isBlank()) t.setName(req.getName().trim());
        if (req.getDescription() != null) t.setDescription(req.getDescription());
        if (req.getSortOrder() != null) t.setSortOrder(req.getSortOrder());

        if (Boolean.TRUE.equals(req.getMoveParent())) {
            String newParentId = req.getParentId();
            if (newParentId != null) {
                if (newParentId.equals(teamId)) {
                    throw new VacademyException("A team cannot be its own parent");
                }
                OrganizationTeam newParent = teamRepo.findById(newParentId)
                        .orElseThrow(() -> new VacademyException("Parent team not found: " + newParentId));
                if (!newParent.getInstituteId().equals(t.getInstituteId())) {
                    throw new VacademyException("Cannot move team across institutes");
                }
                if (hierarchyService.wouldCreateCycle(teamId, newParentId)) {
                    throw new VacademyException("Move would create a cycle in the org chart");
                }
            }
            t.setParentId(newParentId);
        }
        return toDTO(teamRepo.save(t), mappingRepo.countActiveByTeam(t.getId()));
    }

    @Transactional
    public void deleteTeam(String teamId, boolean cascade) {
        OrganizationTeam t = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        long childCount = teamRepo.countActiveChildren(teamId);
        if (childCount > 0 && !cascade) {
            throw new VacademyException("Team has " + childCount + " active sub-teams. " +
                    "Pass cascade=true to delete the entire subtree.");
        }
        if (cascade) {
            List<OrganizationTeam> subtree = teamRepo.findSubtreeIncludingSelf(teamId);
            for (int i = subtree.size() - 1; i >= 0; i--) {
                OrganizationTeam node = subtree.get(i);
                node.setStatus("INACTIVE");
                teamRepo.save(node);
            }
        } else {
            t.setStatus("INACTIVE");
            teamRepo.save(t);
        }
    }

    // ────────────────────────────────────────────────────────────────
    // Reads
    // ────────────────────────────────────────────────────────────────

    public List<OrgTeamDTO> getAncestors(String teamId) {
        return hierarchyService.getAllAncestors(teamId).stream()
                .map(t -> toDTO(t, mappingRepo.countActiveByTeam(t.getId())))
                .collect(Collectors.toList());
    }

    public List<OrgTeamDTO> getDescendantsFlat(String teamId) {
        return hierarchyService.getAllDescendants(teamId).stream()
                .map(t -> toDTO(t, mappingRepo.countActiveByTeam(t.getId())))
                .collect(Collectors.toList());
    }

    /** Subtree including the team itself — admin_core_service needs this for scoping. */
    public List<OrgTeamDTO> getSubtreeIncludingSelf(String teamId) {
        return hierarchyService.getSubtreeIncludingSelf(teamId).stream()
                .map(t -> toDTO(t, mappingRepo.countActiveByTeam(t.getId())))
                .collect(Collectors.toList());
    }

    /**
     * Same as {@link #getChart(String)} but each node also carries its
     * ACTIVE members. Total cost: 2 DB reads (all teams + all mappings
     * across the institute), regardless of tree depth — no N+1.
     */
    public List<OrgTeamNodeDTO> getChartWithMembers(String instituteId) {
        List<OrgTeamNodeDTO> tree = getChart(instituteId);
        if (tree.isEmpty()) return tree;
        Map<String, OrgTeamNodeDTO> byId = new HashMap<>();
        collectNodes(tree, byId);
        if (byId.isEmpty()) return tree;
        // Seed empty lists so the UI can tell "no members" from "not loaded".
        byId.values().forEach(n -> n.setMembers(new ArrayList<>()));
        var mappings = mappingRepo.findActiveByTeamIds(byId.keySet());
        for (var m : mappings) {
            OrgTeamNodeDTO node = byId.get(m.getTeamId());
            if (node != null) node.getMembers().add(toMemberDTO(m));
        }
        return tree;
    }

    private void collectNodes(List<OrgTeamNodeDTO> nodes, Map<String, OrgTeamNodeDTO> out) {
        for (OrgTeamNodeDTO n : nodes) {
            out.put(n.getId(), n);
            if (n.getChildren() != null && !n.getChildren().isEmpty()) {
                collectNodes(n.getChildren(), out);
            }
        }
    }

    public List<OrgTeamNodeDTO> getChart(String instituteId) {
        List<OrganizationTeam> all = teamRepo.findAllActive(instituteId);
        if (all.isEmpty()) return Collections.emptyList();

        Map<String, Long> memberCounts = new HashMap<>();
        for (OrganizationTeam t : all) {
            memberCounts.put(t.getId(), mappingRepo.countActiveByTeam(t.getId()));
        }

        Map<String, OrgTeamNodeDTO> nodeById = new HashMap<>();
        for (OrganizationTeam t : all) {
            nodeById.put(t.getId(), OrgTeamNodeDTO.builder()
                    .id(t.getId())
                    .parentId(t.getParentId())
                    .name(t.getName())
                    .description(t.getDescription())
                    .headUserId(t.getHeadUserId())
                    .sortOrder(t.getSortOrder())
                    .memberCount(memberCounts.getOrDefault(t.getId(), 0L))
                    .children(new ArrayList<>())
                    .build());
        }

        List<OrgTeamNodeDTO> roots = new ArrayList<>();
        for (OrgTeamNodeDTO node : nodeById.values()) {
            if (node.getParentId() == null) {
                roots.add(node);
            } else {
                OrgTeamNodeDTO parent = nodeById.get(node.getParentId());
                if (parent != null) parent.getChildren().add(node);
                else roots.add(node);
            }
        }
        return roots;
    }

    // ────────────────────────────────────────────────────────────────
    // Membership
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public TeamMemberDTO addMember(String teamId, AddMemberRequest req, String addedBy) {
        OrganizationTeam team = teamRepo.findById(teamId)
                .orElseThrow(() -> new VacademyException("Team not found: " + teamId));
        if (req.getUserId() == null || req.getUserId().isBlank()) {
            throw new VacademyException("user_id is required");
        }
        if (req.getRoleName() == null || req.getRoleName().isBlank()) {
            throw new VacademyException("role_name is required");
        }
        if (STUDENT_ROLE.equalsIgnoreCase(req.getRoleName())) {
            throw new VacademyException("STUDENT role is not permitted in organization teams");
        }

        UserOrganizationTeamMapping m = UserOrganizationTeamMapping.builder()
                .teamId(teamId)
                .userId(req.getUserId())
                .roleName(req.getRoleName())
                .roleLabel(req.getRoleLabel())
                .isTeamHead(Boolean.TRUE.equals(req.getIsTeamHead()))
                .status("ACTIVE")
                .addedBy(addedBy)
                .build();

        if (m.getIsTeamHead()) {
            mappingRepo.clearTeamHeadFlag(teamId);
            team.setHeadUserId(req.getUserId());
            teamRepo.save(team);
        }
        return toMemberDTO(mappingRepo.save(m));
    }

    @Transactional
    public TeamMemberDTO updateMember(String teamId, String mappingId, UpdateMemberRequest req) {
        UserOrganizationTeamMapping m = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Mapping not found: " + mappingId));
        if (!m.getTeamId().equals(teamId)) {
            throw new VacademyException("Mapping does not belong to team " + teamId);
        }
        if (req.getRoleLabel() != null) m.setRoleLabel(req.getRoleLabel());
        if (Boolean.TRUE.equals(req.getIsTeamHead()) && !Boolean.TRUE.equals(m.getIsTeamHead())) {
            mappingRepo.clearTeamHeadFlag(teamId);
            m.setIsTeamHead(true);
            teamRepo.findById(teamId).ifPresent(t -> {
                t.setHeadUserId(m.getUserId());
                teamRepo.save(t);
            });
        } else if (Boolean.FALSE.equals(req.getIsTeamHead()) && Boolean.TRUE.equals(m.getIsTeamHead())) {
            m.setIsTeamHead(false);
            teamRepo.findById(teamId).ifPresent(t -> {
                t.setHeadUserId(null);
                teamRepo.save(t);
            });
        }
        return toMemberDTO(mappingRepo.save(m));
    }

    @Transactional
    public void removeMember(String teamId, String mappingId) {
        UserOrganizationTeamMapping m = mappingRepo.findById(mappingId)
                .orElseThrow(() -> new VacademyException("Mapping not found: " + mappingId));
        if (!m.getTeamId().equals(teamId)) {
            throw new VacademyException("Mapping does not belong to team " + teamId);
        }
        m.setStatus("INACTIVE");
        if (Boolean.TRUE.equals(m.getIsTeamHead())) {
            m.setIsTeamHead(false);
            teamRepo.findById(teamId).ifPresent(t -> {
                t.setHeadUserId(null);
                teamRepo.save(t);
            });
        }
        mappingRepo.save(m);
    }

    public List<TeamMemberDTO> listMembers(String teamId) {
        return mappingRepo.findActiveByTeam(teamId).stream()
                .map(this::toMemberDTO).collect(Collectors.toList());
    }

    /** Distinct user ids across the given teams (used by the workbench team scope). */
    public List<String> usersInTeams(Collection<String> teamIds) {
        if (teamIds == null || teamIds.isEmpty()) return Collections.emptyList();
        return mappingRepo.findDistinctUserIdsByTeamIds(teamIds);
    }

    /** All active team-mappings for a single user (used by the workbench home-scope resolver). */
    public List<TeamMemberDTO> mappingsForUser(String userId) {
        return mappingRepo.findActiveByUser(userId).stream()
                .map(this::toMemberDTO).collect(Collectors.toList());
    }

    // ────────────────────────────────────────────────────────────────
    // Mapping helpers
    // ────────────────────────────────────────────────────────────────

    private OrgTeamDTO toDTO(OrganizationTeam t, long memberCount) {
        return OrgTeamDTO.builder()
                .id(t.getId())
                .instituteId(t.getInstituteId())
                .parentId(t.getParentId())
                .name(t.getName())
                .description(t.getDescription())
                .headUserId(t.getHeadUserId())
                .status(t.getStatus())
                .sortOrder(t.getSortOrder())
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
                .roleName(m.getRoleName())
                .roleLabel(m.getRoleLabel())
                .isTeamHead(m.getIsTeamHead())
                .status(m.getStatus())
                .addedAt(m.getAddedAt())
                .build();
    }
}
