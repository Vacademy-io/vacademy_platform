package vacademy.io.auth_service.feature.user.repository;



import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.UserRole;

import java.util.List;

@Repository
public interface RoleRepository extends CrudRepository<UserRole, String> {

    @Query(value = "SELECT DISTINCT r.* " +
            "FROM users u " +
            "JOIN user_role ur ON u.id = ur.user_id " +
            "JOIN roles r ON ur.role_id = r.id " +
            "WHERE u.id = :userId",
            nativeQuery = true)
    List<UserRole> findRolesByUserId(@Param("userId") String userId);

    @Query(value = "SELECT COUNT(*) > 0 FROM users WHERE id = :userId", nativeQuery = true)
    boolean existsByUserId(@Param("userId") String userId);

    @Query(value = "SELECT r.* " +
            "FROM user_role ur " +
            "JOIN roles r ON ur.role_id = r.id " +
            "WHERE ur.user_id = :userId AND ur.institute_id = :instituteId", nativeQuery = true)
    List<UserRole> findRoleNamesByUserIdAndInstituteId(@Param("userId") String userId, @Param("instituteId") String instituteId);

    @Query(value = "SELECT * FROM roles WHERE role_name = :roleName", nativeQuery = true)
    List<UserRole> findRolesByRoleName(@Param("roleName") String roleName);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO user_role (user_id, role_id, institute_id) VALUES (:userId, :roleId, :instituteId)", nativeQuery = true)
    void saveUserRole(@Param("userId") String userId, @Param("roleId") String roleId, @Param("instituteId") String instituteId);

}
