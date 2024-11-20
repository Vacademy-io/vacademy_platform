package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.entity.Staff;

@Repository
public interface StaffRepository extends CrudRepository<Staff, String> {
}
