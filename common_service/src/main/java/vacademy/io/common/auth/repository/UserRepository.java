package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends CrudRepository<User, String> {
        Optional<User> findByUsername(String username);

        @Query(value = """
                        SELECT u.* FROM users u
                        JOIN user_role ur ON u.id = ur.user_id
                        JOIN roles r ON r.id = ur.role_id
                        WHERE LOWER(u.email) = LOWER(:email)
                          AND ur.status IN (:roleStatus)
                          AND r.role_name IN (:roleNames)
                        ORDER BY u.created_at DESC
                        LIMIT 1
                        """, nativeQuery = true)
        Optional<User> findMostRecentUserByEmailAndRoleStatusAndRoleNames(
                        @Param("email") String email,
                        @Param("roleStatus") List<String> roleStatus,
                        @Param("roleNames") List<String> roleNames);

        List<User> findByIdIn(List<String> userIds);

        @Modifying
        @Transactional
        @Query(value = "INSERT INTO user_role (user_id, role_id) VALUES (:userId, :roleId)", nativeQuery = true)
        void addRoleToUser(@Param("userId") String userId, @Param("roleId") String roleId);

        @Modifying
        @Transactional
        @Query(value = "INSERT INTO user_permission (user_id, permission_id) VALUES (:userId, :permissionId)", nativeQuery = true)
        void addPermissionToUser(@Param("userId") String userId, @Param("permissionId") String permissionId);

        @Query(value = "SELECT u.* " +
                        "FROM users u WHERE u.id = :userId", nativeQuery = true)
        List<User> findUserDetailsById(@Param("userId") String userId);

        @Query(value = "SELECT u.* " +
                        "FROM users u WHERE u.id IN (:userIds)", nativeQuery = true)
        List<User> findUserDetailsByIds(@Param("userIds") List<String> userIds);

        @Query(value = "SELECT u.* " +
                        "FROM users u WHERE u.username = :username", nativeQuery = true)
        List<User> findUserDetailsByUsername(@Param("username") String username);

        @Query(value = "SELECT u.* " +
                        "FROM users u WHERE LOWER(u.email) = LOWER(:email) order by u.created_at desc", nativeQuery = true)
        List<User> findUserDetailsByEmail(@Param("email") String email);

        @Modifying
        @Transactional
        @Query(value = "DELETE FROM user_role WHERE user_id = :userId AND role_id = :roleId", nativeQuery = true)
        void removeRoleFromUser(@Param("userId") String userId, @Param("roleId") String roleId);

        @Modifying
        @Transactional
        @Query(value = "DELETE FROM user_permission WHERE user_id = :userId AND permission_id = :permissionId", nativeQuery = true)
        void removePermissionFromUser(@Param("userId") String userId, @Param("permissionId") String permissionId);

        @Query(value = "SELECT COUNT(*) > 0 FROM users WHERE id = :userId", nativeQuery = true)
        boolean existsByUserId(@Param("userId") String userId);

        @Query(value = "SELECT COUNT(*) > 0 FROM roles WHERE id = :roleId", nativeQuery = true)
        boolean existsByRoleId(@Param("roleId") String roleId);

        @Query(value = "SELECT COUNT(*) > 0 FROM permissions WHERE id = :permissionId", nativeQuery = true)
        boolean existsByPermissionId(@Param("permissionId") String permissionId);

        @Query(value = "SELECT COUNT(*) > 0 FROM users WHERE username = :user", nativeQuery = true)
        boolean existsByUserName(@Param("user") String user);

        @Query(value = "SELECT COUNT(*) > 0 FROM user_role WHERE user_id = :userId AND role_id = :roleId", nativeQuery = true)
        boolean existsByUserIdAndRoleId(@Param("userId") String userId, @Param("roleId") String roleId);

        @Query(value = "SELECT COUNT(*) > 0 FROM user_permission WHERE user_id = :userId AND permission_id = :permissionId", nativeQuery = true)
        boolean existsByUserIdAndPermissionId(@Param("userId") String userId,
                        @Param("permissionId") String permissionId);

        @Modifying
        @Transactional
        @Query(value = "DELETE FROM users WHERE id = :userId", nativeQuery = true)
        void deleteUserById(@Param("userId") String userId);

        @Query("SELECT DISTINCT u FROM User u " +
                        "JOIN  u.roles ur " +
                        "JOIN ur.role r " +
                        "WHERE ur.instituteId = :instituteId")
        List<User> findUsersWithRolesByInstituteId(@Param("instituteId") String instituteId);

        @Query("SELECT DISTINCT u FROM User u " +
                        "JOIN u.roles ur " +
                        "JOIN ur.role r " +
                        "WHERE ur.instituteId = :instituteId " +
                        "AND r.name IN :roles " +
                        "AND ur.status IN :statuses")
        List<User> findUsersWithRolesByInstituteIdAndStatuses(
                        @Param("instituteId") String instituteId,
                        @Param("roles") List<String> roles,
                        @Param("statuses") List<String> statuses);

        @Query("SELECT DISTINCT ur.user FROM UserRole ur WHERE ur.status IN :statuses AND ur.role.name IN :roles AND ur.instituteId = :instituteId")
        List<User> findUsersByStatusAndInstitute(@Param("statuses") List<String> statuses,
                        @Param("roles") List<String> roles, @Param("instituteId") String instituteId);

        @Modifying
        @Transactional
        @Query("UPDATE User u SET u.lastTokenUpdateTime = CURRENT_TIMESTAMP WHERE u.id IN :userIds")
        void updateLastTokenUpdateTime(@Param("userIds") List<String> userIds);

        Optional<User> findFirstByEmailOrderByCreatedAtDesc(String email);
}