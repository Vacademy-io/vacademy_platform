package vacademy.io.auth_service.feature.organization.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.organization.entity.UserOrganizationTeamMapping;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserOrganizationTeamMappingRepository
        extends JpaRepository<UserOrganizationTeamMapping, String> {

    /** Active memberships in a team, sorted by added_at. */
    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.status = 'ACTIVE' " +
           "ORDER BY m.addedAt ASC")
    List<UserOrganizationTeamMapping> findActiveByTeam(@Param("teamId") String teamId);

    /** Active memberships across many teams (workbench scope queries). */
    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId IN :teamIds AND m.status = 'ACTIVE'")
    List<UserOrganizationTeamMapping> findActiveByTeamIds(@Param("teamIds") Collection<String> teamIds);

    /** All teams a user is in (multi-team lookup for the "+1 team" badge). */
    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.userId = :userId AND m.status = 'ACTIVE'")
    List<UserOrganizationTeamMapping> findActiveByUser(@Param("userId") String userId);

    /** Single (team, user) ACTIVE row — enforces one membership per pair. */
    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.userId = :userId AND m.status = 'ACTIVE'")
    Optional<UserOrganizationTeamMapping> findActiveByTeamAndUser(
            @Param("teamId") String teamId, @Param("userId") String userId);

    /**
     * Re-parent every ACTIVE mapping in the team whose parent_user_id was
     * the given user to NULL. Used when a person is removed from a team so
     * their reports become roots instead of orphans.
     */
    @Modifying
    @Query("UPDATE UserOrganizationTeamMapping m SET m.parentUserId = NULL " +
           "WHERE m.teamId = :teamId AND m.parentUserId = :parentUserId AND m.status = 'ACTIVE'")
    int promoteChildrenToRoot(@Param("teamId") String teamId,
                              @Param("parentUserId") String parentUserId);

    @Query("SELECT COUNT(m) FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.status = 'ACTIVE'")
    long countActiveByTeam(@Param("teamId") String teamId);

    @Query("SELECT DISTINCT m.userId FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId IN :teamIds AND m.status = 'ACTIVE'")
    List<String> findDistinctUserIdsByTeamIds(@Param("teamIds") Collection<String> teamIds);
}
