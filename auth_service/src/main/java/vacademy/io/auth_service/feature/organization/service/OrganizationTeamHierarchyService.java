package vacademy.io.auth_service.feature.organization.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.auth_service.feature.organization.entity.OrganizationTeam;
import vacademy.io.auth_service.feature.organization.repository.OrganizationTeamRepository;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Hierarchy navigation primitives — getParent / getAllAncestors / getChildren
 * / getAllDescendants / getSubtreeIncludingSelf. All return ACTIVE teams only
 * and are depth-ordered. Self is excluded from getAllAncestors and
 * getAllDescendants; use getSubtreeIncludingSelf when the caller needs it.
 *
 * Consumed in auth_service by OrganizationTeamService and exposed to
 * admin_core_service through OrganizationTeamInternalController.
 */
@Service
@RequiredArgsConstructor
public class OrganizationTeamHierarchyService {

    private final OrganizationTeamRepository teamRepo;

    public List<OrganizationTeam> getRootTeams(String instituteId) {
        return teamRepo.findRootTeams(instituteId);
    }

    public Optional<OrganizationTeam> getParent(String teamId) {
        return teamRepo.findById(teamId)
                .map(OrganizationTeam::getParentId)
                .flatMap(teamRepo::findById);
    }

    public List<OrganizationTeam> getChildren(String teamId) {
        return teamRepo.findChildren(teamId);
    }

    public List<OrganizationTeam> getAllAncestors(String teamId) {
        List<OrganizationTeam> chain = teamRepo.findAllAncestors(teamId);
        if (chain.isEmpty()) return Collections.emptyList();
        return chain.subList(0, chain.size() - 1);
    }

    public List<OrganizationTeam> getAllDescendants(String teamId) {
        List<OrganizationTeam> subtree = teamRepo.findSubtreeIncludingSelf(teamId);
        if (subtree.isEmpty()) return Collections.emptyList();
        return subtree.subList(1, subtree.size());
    }

    public List<OrganizationTeam> getSubtreeIncludingSelf(String teamId) {
        return teamRepo.findSubtreeIncludingSelf(teamId);
    }

    public boolean wouldCreateCycle(String teamId, String candidateParentId) {
        if (teamId == null || candidateParentId == null) return false;
        if (teamId.equals(candidateParentId)) return true;
        return teamRepo.isAncestor(teamId, candidateParentId);
    }
}
