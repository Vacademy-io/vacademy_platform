package vacademy.io.auth_service.feature.user.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.user.dto.PermissionDTO;
import vacademy.io.auth_service.feature.user.dto.UserDTO;
import vacademy.io.auth_service.feature.user.entity.Users;

import java.util.List;
import java.util.Optional;


@Repository
public interface UsersRepository extends CrudRepository<Users, String> {


    @Query(value = "SELECT DISTINCT p.id AS permissionId, p.permission_name AS permissionName, p.tag AS tag " +
            "FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN role_permission rp ON ur.role_id = rp.role_id " +
            "JOIN permissions p ON rp.permission_id = p.id " +
            "WHERE u.id = :userId " +
            "UNION " +
            "SELECT DISTINCT p.id AS permissionId, p.permission_name AS permissionName, p.tag AS tag " +
            "FROM users u " +
            "JOIN user_permission up ON u.id = up.user_id " +
            "JOIN permissions p ON up.permission_id = p.id " +
            "WHERE u.id = :userId",
            nativeQuery = true)
    List<Object[]> findPermissionsByUserId(@Param("userId") String userId);


    @Query(value = "SELECT DISTINCT r.id AS id, r.role_name AS roleName " +
            "FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN roles r ON ur.role_id = r.id " +
            "WHERE u.id = :userId",
            nativeQuery = true)
    List<Object[]> findRolesByUserId(@Param("userId") String userId);

    @Query(value = "SELECT DISTINCT p.id AS permissionId, p.permission_name AS permissionName, p.tag AS tag " +
            "FROM role_permission rp " +
            "JOIN permissions p ON rp.permission_id = p.id " +
            "JOIN roles r ON rp.role_id = r.id " +
            "WHERE r.id IN :roleId",
            nativeQuery = true)
    List<Object[]> findPermissionsByListOfRoleId(@Param("roleId") List<String> roleId);


    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_role (user_id, role_id) VALUES (:userId, :roleId)", nativeQuery = true)
    void addRoleToUser(@Param("userId") String userId, @Param("roleId") String roleId);


    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_permission (user_id, permission_id) VALUES (:userId, :permissionId)", nativeQuery = true)
    void addPermissionToUser(@Param("userId") String userId, @Param("permissionId") String permissionId);

    @Query(value = "SELECT u.id, u.username, u.email, u.full_name, u.address_line, u.city, " +
            "u.pin_code, u.mobile_number, u.date_of_birth, u.gender, u.is_root_user " +
            "FROM users u WHERE u.id = :userId", nativeQuery = true)
    List<Object[]> findUserDetailsById(@Param("userId") String userId);


    @Query(value = "SELECT u.id, u.username, u.email, u.full_name, u.address_line, u.city, " +
            "u.pin_code, u.mobile_number, u.date_of_birth, u.gender, u.is_root_user " +
            "FROM users u WHERE u.id IN (:userIds)",
            nativeQuery = true)
    List<Object[]> findUserDetailsByIds(@Param("userIds") List<String> userIds);

    @Query(value = "SELECT u.id, u.username, u.email, u.full_name, u.address_line, u.city, " +
            "u.pin_code, u.mobile_number, u.date_of_birth, u.gender, u.is_root_user " +
            "FROM users u WHERE u.username = :username",
            nativeQuery = true)
    List<Object[]> findUserDetailsByUsername(@Param("username") String username);



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
