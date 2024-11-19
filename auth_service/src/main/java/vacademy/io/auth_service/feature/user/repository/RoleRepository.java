package vacademy.io.auth_service.feature.user.repository;


import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
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

}
