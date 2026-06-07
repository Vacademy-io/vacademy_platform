package vacademy.io.auth_service.feature.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.organization.entity.OrganizationTeam;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationTeamRepository extends JpaRepository<OrganizationTeam, String> {

    @Query("SELECT t FROM OrganizationTeam t " +
           "WHERE t.instituteId = :instituteId AND t.parentId IS NULL AND t.status = 'ACTIVE' " +
           "ORDER BY t.sortOrder ASC, t.name ASC")
    List<OrganizationTeam> findRootTeams(@Param("instituteId") String instituteId);

    @Query("SELECT t FROM OrganizationTeam t " +
           "WHERE t.parentId = :parentId AND t.status = 'ACTIVE' " +
           "ORDER BY t.sortOrder ASC, t.name ASC")
    List<OrganizationTeam> findChildren(@Param("parentId") String parentId);

    @Query("SELECT t FROM OrganizationTeam t " +
           "WHERE t.instituteId = :instituteId AND t.status = 'ACTIVE' " +
           "ORDER BY t.sortOrder ASC, t.name ASC")
    List<OrganizationTeam> findAllActive(@Param("instituteId") String instituteId);

    /**
     * Recursive ancestor walk: root → … → :teamId. Returns the chain in
     * descending depth order so the first element is the root vertical.
     * Used for breadcrumbs and cycle detection on re-parent.
     */
    @Query(value = """
            WITH RECURSIVE ancestors(id, parent_id, depth) AS (
                SELECT id, parent_id, 0 FROM organization_team WHERE id = :teamId
                UNION ALL
                SELECT t.id, t.parent_id, a.depth + 1
                FROM organization_team t
                JOIN ancestors a ON t.id = a.parent_id
                WHERE t.status = 'ACTIVE'
            )
            SELECT t.* FROM organization_team t
            JOIN ancestors a ON a.id = t.id
            ORDER BY a.depth DESC
            """, nativeQuery = true)
    List<OrganizationTeam> findAllAncestors(@Param("teamId") String teamId);

    /**
     * Recursive descendant walk including the team itself. Flat result,
     * ordered by depth then sort_order. Self row is at depth 0.
     */
    @Query(value = """
            WITH RECURSIVE descendants(id, parent_id, depth, sort_order) AS (
                SELECT id, parent_id, 0, sort_order FROM organization_team
                WHERE id = :teamId AND status = 'ACTIVE'
                UNION ALL
                SELECT t.id, t.parent_id, d.depth + 1, t.sort_order
                FROM organization_team t
                JOIN descendants d ON t.parent_id = d.id
                WHERE t.status = 'ACTIVE'
            )
            SELECT t.* FROM organization_team t
            JOIN descendants d ON d.id = t.id
            ORDER BY d.depth ASC, d.sort_order ASC, t.name ASC
            """, nativeQuery = true)
    List<OrganizationTeam> findSubtreeIncludingSelf(@Param("teamId") String teamId);

    /** Cycle guard: is :teamId an ancestor of :candidateParentId? */
    @Query(value = """
            WITH RECURSIVE ancestors(id, parent_id) AS (
                SELECT id, parent_id FROM organization_team WHERE id = :candidateParentId
                UNION ALL
                SELECT t.id, t.parent_id
                FROM organization_team t
                JOIN ancestors a ON t.id = a.parent_id
            )
            SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = :teamId)
            """, nativeQuery = true)
    boolean isAncestor(@Param("teamId") String teamId,
                       @Param("candidateParentId") String candidateParentId);

    Optional<OrganizationTeam> findByIdAndStatus(String id, String status);

    @Query("SELECT COUNT(t) FROM OrganizationTeam t WHERE t.parentId = :teamId AND t.status = 'ACTIVE'")
    long countActiveChildren(@Param("teamId") String teamId);
}
