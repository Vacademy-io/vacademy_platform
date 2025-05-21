package vacademy.io.admin_core_service.features.doubts.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;


@Repository
public interface DoubtsAssigneeRepository extends JpaRepository<DoubtAssignee, String> {

}
