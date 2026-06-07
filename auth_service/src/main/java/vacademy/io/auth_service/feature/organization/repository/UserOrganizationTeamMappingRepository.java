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
public interface UserOrganizationTeamMappingRepository extends JpaRepository<UserOrganizationTeamMapping, String> {

    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.status = 'ACTIVE' " +
           "ORDER BY m.isTeamHead DESC, m.addedAt ASC")
    List<UserOrganizationTeamMapping> findActiveByTeam(@Param("teamId") String teamId);

    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId IN :teamIds AND m.status = 'ACTIVE'")
    List<UserOrganizationTeamMapping> findActiveByTeamIds(@Param("teamIds") Collection<String> teamIds);

    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.userId = :userId AND m.status = 'ACTIVE'")
    List<UserOrganizationTeamMapping> findActiveByUser(@Param("userId") String userId);

    @Query("SELECT m FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.isTeamHead = TRUE AND m.status = 'ACTIVE'")
    Optional<UserOrganizationTeamMapping> findActiveHead(@Param("teamId") String teamId);

    @Modifying
    @Query("UPDATE UserOrganizationTeamMapping m SET m.isTeamHead = FALSE " +
           "WHERE m.teamId = :teamId AND m.isTeamHead = TRUE")
    int clearTeamHeadFlag(@Param("teamId") String teamId);

    @Query("SELECT COUNT(m) FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId = :teamId AND m.status = 'ACTIVE'")
    long countActiveByTeam(@Param("teamId") String teamId);

    @Query("SELECT DISTINCT m.userId FROM UserOrganizationTeamMapping m " +
           "WHERE m.teamId IN :teamIds AND m.status = 'ACTIVE'")
    List<String> findDistinctUserIdsByTeamIds(@Param("teamIds") Collection<String> teamIds);
}
