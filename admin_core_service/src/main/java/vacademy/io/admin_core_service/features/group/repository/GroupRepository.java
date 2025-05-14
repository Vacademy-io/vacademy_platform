package vacademy.io.admin_core_service.features.group.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.common.institute.entity.Group;

public interface GroupRepository extends JpaRepository<Group, String> {
}
