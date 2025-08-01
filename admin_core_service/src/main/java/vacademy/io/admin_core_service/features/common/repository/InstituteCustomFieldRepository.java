package vacademy.io.admin_core_service.features.common.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;

import java.util.List;

@Repository
public interface InstituteCustomFieldRepository extends JpaRepository<InstituteCustomField, String> {

    @Transactional
    void deleteByCustomFieldId(String customFieldId);

    @Query("SELECT icf, cf FROM InstituteCustomField icf, CustomFields cf " +
            "WHERE cf.id = icf.customFieldId " +
            "AND icf.instituteId = :instituteId " +
            "AND icf.type = :type " +
            "AND icf.typeId = :typeId " +
            "ORDER BY cf.formOrder ASC")
    List<Object[]> findInstituteCustomFieldsWithDetails(
            @Param("instituteId") String instituteId,
            @Param("type") String type,
            @Param("typeId") String typeId);


}

