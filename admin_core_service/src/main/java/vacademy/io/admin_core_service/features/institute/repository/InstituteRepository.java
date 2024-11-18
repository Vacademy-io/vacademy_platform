package vacademy.io.admin_core_service.features.institute.repository;


import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.entity.Institute;

import java.util.List;

@Repository
public interface InstituteRepository extends CrudRepository<Institute, String> {

    @Query(value = "SELECT DISTINCT i.* " +
            "FROM staff s " +
            "JOIN institutes i ON s.institute_id = i.id " +
            "WHERE s.user_id = :userId", nativeQuery = true)
    List<Institute> findInstitutesByUserId(@Param("userId") String userId);


    @Transactional
    @Modifying
    @Query(value = "INSERT INTO institutes (id, name, country, state, city, address_line, pin_code, email, mobile_number, website_url) " +
            "VALUES (:newId, :#{#institute.instituteName}, :#{#institute.country}, :#{#institute.state}, :#{#institute.city}, " +
            ":#{#institute.address}, :#{#institute.pinCode}, :#{#institute.email}, :#{#institute.mobileNumber}, :#{#institute.websiteUrl})",
            nativeQuery = true)
    void insertInstitute(@Param("newId") String newId,
                         @Param("institute") Institute institute);

}
