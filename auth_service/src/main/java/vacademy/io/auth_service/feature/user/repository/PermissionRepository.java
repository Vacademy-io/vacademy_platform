package vacademy.io.auth_service.feature.user.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.common.auth.entity.UserAuthority;

import java.util.List;

@Repository
public interface PermissionRepository extends CrudRepository<UserAuthority, String> {


    @Query(value = "SELECT DISTINCT p.* " +
            "FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN role_permission rp ON ur.role_id = rp.role_id " +
            "JOIN permissions p ON rp.permission_id = p.id " +
            "WHERE u.id = :userId " +
            "UNION " +
            "SELECT DISTINCT p.* " +
            "FROM users u " +
            "JOIN user_permission up ON u.id = up.user_id " +
            "JOIN permissions p ON up.permission_id = p.id " +
            "WHERE u.id = :userId",
            nativeQuery = true)
    List<UserAuthority> findPermissionsByUserId(@Param("userId") String userId);


    @Query(value = "SELECT p.* " +
            "FROM permissions p",
            nativeQuery = true)
    List<UserAuthority> findAllPermissionsWithTag();

    @Query(value = "SELECT DISTINCT p.* " +
            "FROM role_permission rp " +
            "JOIN permissions p ON rp.permission_id = p.id " +
            "JOIN roles r ON rp.role_id = r.id " +
            "WHERE r.id IN :roleId",
            nativeQuery = true)
    List<UserAuthority> findPermissionsByListOfRoleId(@Param("roleId") List<String> roleId);

    @Query(value = "SELECT COUNT(*) > 0 FROM users WHERE id = :userId", nativeQuery = true)
    boolean existsByUserId(@Param("userId") String userId);

    @Query(value = "SELECT COUNT(*) > 0 FROM roles WHERE id = :roleId", nativeQuery = true)
    boolean existsByRoleId(@Param("roleId") String roleId);


    @Query(value = "SELECT DISTINCT p.* " +
            "FROM user_role ur " +
            "JOIN role_permission rp ON ur.role_id = rp.role_id " +
            "JOIN permissions p ON rp.permission_id = p.id " +
            "WHERE ur.user_id = :userId AND ur.institute_id = :instituteId",
            nativeQuery = true)
    List<UserAuthority> findPermissionsByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);

}
