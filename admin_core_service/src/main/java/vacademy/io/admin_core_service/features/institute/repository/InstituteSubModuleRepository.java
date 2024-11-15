package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubModule;
import vacademy.io.admin_core_service.features.institute.entity.Staff;

import java.util.List;

@Repository
public interface InstituteSubModuleRepository extends CrudRepository<InstituteSubModule, String> {

    @Query(value = "SELECT DISTINCT ism.* " +
            "FROM institute_submodule_mapping ism " +
            "WHERE ism.institute_id = :instituteId", nativeQuery = true)
    List<InstituteSubModule> findSubModulesByInstituteId(@Param("instituteId") String instituteId);
}
