package vacademy.io.admin_core_service.features.common.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;

public interface CustomFieldValuesRepository extends JpaRepository<CustomFieldValues, String> {
}
