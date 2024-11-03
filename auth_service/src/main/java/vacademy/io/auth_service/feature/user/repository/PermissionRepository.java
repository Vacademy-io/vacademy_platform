package vacademy.io.auth_service.feature.user.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.auth_service.feature.user.entity.Permission;

import java.util.List;

@Repository
public interface PermissionRepository extends CrudRepository<Permission, String> {


    @Query(value = "SELECT p.id AS permissionId, p.permission_name AS permissionName, p.tag AS tag " +
            "FROM permissions p",
            nativeQuery = true)
    List<Object[]> findAllPermissionsWithTag();

}
