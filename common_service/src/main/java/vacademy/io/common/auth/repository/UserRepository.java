package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.User;

import java.util.Date;
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

    @Query(value = """
            SELECT u.* FROM users u
            JOIN user_role ur ON u.id = ur.user_id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.mobile = :mobile
              AND ur.status IN (:roleStatus)
              AND r.role_name IN (:roleNames)
            ORDER BY u.created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<User> findMostRecentUserByMobileAndRoleStatusAndRoleNames(
            @Param("mobile") String mobile,
            @Param("roleStatus") List<String> roleStatus,
            @Param("roleNames") List<String> roleNames);

    // NEW METHOD: For WhatsApp OTP login - uses correct column name 'mobile_number'
    @Query(value = """
            SELECT u.* FROM users u
            JOIN user_role ur ON u.id = ur.user_id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.mobile_number = :mobileNumber
              AND ur.status IN (:roleStatus)
              AND r.role_name IN (:roleNames)
            ORDER BY u.created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<User> findUserByMobileNumberAndRoleStatusAndRoleNames(
            @Param("mobileNumber") String mobileNumber,
            @Param("roleStatus") List<String> roleStatus,
            @Param("roleNames") List<String> roleNames);

    List<User> findByIdIn(List<String> userIds);

    /**
     * Find all children linked to the given parent IDs.
     * 
     * @param parentIds List of parent user IDs
     * @return List of child users where linked_parent_id is in the provided list
     */
    List<User> findByLinkedParentIdIn(List<String> parentIds);

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

    @Query(value = "SELECT DISTINCT u.* FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN roles r ON r.id = ur.role_id " +
            "WHERE ur.status IN (:statuses) " +
            "AND r.role_name IN (:roles) " +
            "AND ur.institute_id = :instituteId " +
            "AND (:name IS NULL OR CAST(u.full_name AS TEXT) ILIKE CONCAT('%', :name, '%')) " +
            "AND (:email IS NULL OR CAST(u.email AS TEXT) ILIKE CONCAT('%', :email, '%')) " +
            "AND (:mobile IS NULL OR u.mobile_number LIKE CONCAT('%', :mobile, '%')) " +
            "ORDER BY u.full_name ASC", nativeQuery = true)
    List<User> findUsersByStatusAndInstitutePaged(@Param("statuses") List<String> statuses,
            @Param("roles") List<String> roles, @Param("instituteId") String instituteId,
            @Param("name") String name,
            @Param("email") String email,
            @Param("mobile") String mobile,
            org.springframework.data.domain.Pageable pageable);

    @Query(value = "SELECT COUNT(DISTINCT u.id) FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN roles r ON r.id = ur.role_id " +
            "WHERE ur.status IN (:statuses) " +
            "AND r.role_name IN (:roles) " +
            "AND ur.institute_id = :instituteId " +
            "AND (:name IS NULL OR CAST(u.full_name AS TEXT) ILIKE CONCAT('%', :name, '%')) " +
            "AND (:email IS NULL OR CAST(u.email AS TEXT) ILIKE CONCAT('%', :email, '%')) " +
            "AND (:mobile IS NULL OR u.mobile_number LIKE CONCAT('%', :mobile, '%'))", nativeQuery = true)
    long countUsersByStatusAndInstitute(@Param("statuses") List<String> statuses,
            @Param("roles") List<String> roles, @Param("instituteId") String instituteId,
            @Param("name") String name,
            @Param("email") String email,
            @Param("mobile") String mobile);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.lastTokenUpdateTime = CURRENT_TIMESTAMP WHERE u.id IN :userIds")
    void updateLastTokenUpdateTime(@Param("userIds") List<String> userIds);

    Optional<User> findFirstByEmailOrderByCreatedAtDesc(String email);

    /**
     * Find user by username and institute ID for trusted login.
     * ⚠️ TEMPORARY: Used for emergency trusted login when email service is down.
     * TODO: Consider removing when email service is restored.
     */
    @Query(value = """
            SELECT DISTINCT u.* FROM users u
            JOIN user_role ur ON u.id = ur.user_id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.username = :username
              AND ur.institute_id = :instituteId
              AND ur.status IN ('ACTIVE', 'INVITED')
              AND r.role_name IN ('STUDENT')
            ORDER BY u.created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<User> findUserByUsernameAndInstituteId(
            @Param("username") String username,
            @Param("instituteId") String instituteId);

    // In your UserRepository.java
    // In your UserRepository.java
    @Query("SELECT DISTINCT u FROM User u " +
            "JOIN u.roles ur " +
            "JOIN ur.role r " +
            "WHERE ur.instituteId = :instituteId " +
            "AND r.name IN :roles " +
            "AND ur.status IN :statuses " +
            "AND (u.lastLoginTime IS NULL OR FUNCTION('DATE', u.lastLoginTime) = :targetDate)")
    List<User> findUsersInactiveOnDate(
            @Param("instituteId") String instituteId,
            @Param("roles") List<String> roles,
            @Param("statuses") List<String> statuses,
            @Param("targetDate") Date targetDate);

    @Query("SELECT DISTINCT u FROM User u " +
            "JOIN u.roles ur " +
            "JOIN ur.role r " +
            "WHERE ur.instituteId = :instituteId " +
            "AND r.name IN :roles " +
            "AND ur.status IN :statuses " +
            "AND (u.lastLoginTime IS NULL OR u.lastLoginTime <= :targetDate) " +
            "ORDER BY u.lastLoginTime ASC NULLS FIRST")
    List<User> findUsersInactiveForDaysOrMore(
            @Param("instituteId") String instituteId,
            @Param("roles") List<String> roles,
            @Param("statuses") List<String> statuses,
            @Param("targetDate") Date targetDate);

    @Query(value = """
            SELECT DISTINCT u.* FROM users u
            JOIN user_role ur ON u.id = ur.user_id
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.status = 'ACTIVE'
            AND ur.institute_id = :instituteId
            AND (:roleNames IS NULL OR r.role_name IN (:roleNames))
            AND (
                (:query IS NULL OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :query, '%'))) OR
                (:query IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))) OR
                (:query IS NULL OR u.mobile_number LIKE CONCAT('%', :query, '%'))
            )
            ORDER BY u.full_name ASC
            LIMIT 10
            """, nativeQuery = true)
    List<User> autoSuggestUsers(@Param("instituteId") String instituteId,
            @Param("roleNames") List<String> roleNames,
            @Param("query") String query);

    @Query(value = """
            SELECT DISTINCT u.* FROM users u
            JOIN user_role ur ON u.id = ur.user_id
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.status = 'ACTIVE'
            AND ur.institute_id = :instituteId
            AND (
                (:query IS NULL OR LOWER(u.full_name) LIKE LOWER(CONCAT('%', :query, '%'))) OR
                (:query IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))) OR
                (:query IS NULL OR u.mobile_number LIKE CONCAT('%', :query, '%'))
            )
            ORDER BY u.full_name ASC
            LIMIT 10
            """, nativeQuery = true)
    List<User> autoSuggestUsersAllRoles(@Param("instituteId") String instituteId,
            @Param("query") String query);

}
