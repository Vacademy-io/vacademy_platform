package vacademy.io.common.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.common.auth.entity.UserPermission;

import java.util.List;
import java.util.Set;

public interface UserPermissionRepository extends JpaRepository<UserPermission, String> {
    @Modifying
    @Transactional
    @Query(value = "DELETE FROM user_permission WHERE user_id = :userId AND permission_id IN (:permissionIds)", nativeQuery = true)
    void deleteByUserIdAndPermissionIds(@Param("userId") String userId, @Param("permissionIds") Set<String> permissionIds);

    List<UserPermission> findByUserId(String userId);

}
