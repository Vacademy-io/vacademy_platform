package vacademy.io.auth_service.feature.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.user.entity.Users;


import java.util.List;


@Repository
public interface UsersRepository extends JpaRepository<Users, String> {


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
    List<Users> findUserDetailsById(@Param("userId") String userId);


    @Query(value = "SELECT u.* " +
            "FROM users u WHERE u.id IN (:userIds)",
            nativeQuery = true)
    List<Users> findUserDetailsByIds(@Param("userIds") List<String> userIds);

    @Query(value = "SELECT u.* " +
            "FROM users u WHERE u.username = :username",
            nativeQuery = true)
    List<Users> findUserDetailsByUsername(@Param("username") String username);



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


    @Query(value="SELECT COUNT(*) > 0 FROM permissions WHERE id = :permissionId", nativeQuery = true)
    boolean existsByPermissionId(@Param("permissionId") String permissionId);

    @Query(value="SELECT COUNT(*) > 0 FROM users WHERE username = :user", nativeQuery = true)
    boolean existsByUserName(@Param("user") String user);

    @Query(value="SELECT COUNT(*) > 0 FROM user_role WHERE user_id = :userId AND role_id = :roleId", nativeQuery = true)
    boolean existsByUserIdAndRoleId(@Param("userId") String userId, @Param("roleId") String roleId);

    @Query(value="SELECT COUNT(*) > 0 FROM user_permission WHERE user_id = :userId AND permission_id = :permissionId", nativeQuery = true)
    boolean existsByUserIdAndPermissionId(@Param("userId") String userId, @Param("permissionId") String permissionId);
}
