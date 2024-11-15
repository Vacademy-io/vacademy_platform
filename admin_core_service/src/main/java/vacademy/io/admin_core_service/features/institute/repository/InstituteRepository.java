package vacademy.io.admin_core_service.features.institute.repository;


import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.Institute;

import java.util.List;

@Repository
public interface InstituteRepository extends CrudRepository<Institute, String> {

    @Query(value = "SELECT DISTINCT i.* " +
            "FROM staff s " +
            "JOIN institutes i ON s.institute_id = i.id " +
            "WHERE s.user_id = :userId", nativeQuery = true)
    List<Institute> findInstitutesByUserId(@Param("userId") String userId);
}
