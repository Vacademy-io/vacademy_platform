package vacademy.io.common.auth.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.dto.RoleCountProjection;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.entity.UserRole;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRoleRepository extends CrudRepository<UserRole, String> {

    List<UserRole> findByUser(User user);

    @Query("""
    SELECT ur FROM UserRole ur
    JOIN ur.role r
    WHERE ur.user.id = :userId
      AND ur.status IN :statuses
      AND r.name IN :roleNames
""")
    List<UserRole> findUserRolesByUserIdAndStatusesAndRoleNames(
            @Param("userId") String userId,
            @Param("statuses") List<String> statuses,
            @Param("roleNames") List<String> roleNames
    );


    @Modifying
    @Transactional
    @Query("DELETE FROM UserRole ur WHERE ur.user.id = :userId AND ur.role.name IN :roleNames")
    void deleteUserRolesByUserIdAndRoleNames(@Param("userId") String userId, @Param("roleNames") List<String> roleNames);

    @Query("SELECT r.name AS roleName, COUNT(ur.user.id) AS userCount " +
            "FROM UserRole ur JOIN ur.role r " +
            "WHERE ur.instituteId = :instituteId and r.name != 'STUDENT' " +
            "GROUP BY r.name")
    List<RoleCountProjection> getUserRoleCountsByInstituteId(@Param("instituteId") String instituteId);

    @Transactional
    @Modifying
    @Query("UPDATE UserRole ur SET ur.status = :newStatus WHERE ur.instituteId = :instituteId AND ur.user.id IN (:userIds)")
    int updateUserRoleStatusByInstituteIdAndUserId(@Param("newStatus") String newStatus,
                                                   @Param("instituteId") String instituteId,
                                                   @Param("userIds") List<String> userIds);

    @Query("SELECT ur FROM UserRole ur WHERE ur.user = :user AND ur.status = :status AND ur.role.name = :roleName")
    List<UserRole> findByUserAndStatusAndRoleName(@Param("user") User user,
                                                  @Param("status") String status,
                                                  @Param("roleName") String roleName);


    @Query(value = """
    SELECT ur.* FROM user_role ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = :userId
      AND ur.institute_id = :instituteId
      AND r.role_name IN (:roleNames)
      AND ur.status IN (:statuses)
    ORDER BY ur.created_at
    LIMIT 1
    """, nativeQuery = true)
    Optional<UserRole> findFirstByUserIdAndInstituteIdAndRoleNamesAndStatuses(
            @Param("userId") String userId,
            @Param("instituteId") String instituteId,
            @Param("roleNames") List<String> roleNames,
            @Param("statuses") List<String> statuses
    );

    @Query("""
    SELECT CASE WHEN COUNT(u) > 0 THEN TRUE ELSE FALSE END
    FROM User u
    JOIN u.roles ur
    JOIN ur.role r
    WHERE u.email = :email
      AND ur.instituteId = :instituteId
      AND ur.status IN :statuses
      AND r.name IN :roleNames
""")
    boolean existsUserByEmailAndInstituteIdAndStatusesAndRoleNames(
            @Param("email") String email,
            @Param("instituteId") String instituteId,
            @Param("statuses") List<String> statuses,
            @Param("roleNames") List<String> roleNames
    );

    /**
     * Get users by institute and role name - for notification service user resolution
     */
    @Query("""
    SELECT ur.user 
    FROM UserRole ur 
    JOIN ur.role r 
    WHERE ur.instituteId = :instituteId 
      AND r.name = :roleName 
      AND ur.status = 'ACTIVE'
""")
    List<User> findUsersByInstituteIdAndRoleName(
            @Param("instituteId") String instituteId, 
            @Param("roleName") String roleName
    );

}