package vacademy.io.admin_core_service.features.common.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;

import java.util.List;
import java.util.Optional;

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

        @Query("SELECT icf, cf FROM InstituteCustomField icf, CustomFields cf " +
                        "WHERE cf.id = icf.customFieldId " +
                        "AND icf.instituteId = :instituteId " +
                        "AND icf.typeId IS NULL " +
                        "AND icf.status = :status " +
                        "ORDER BY cf.formOrder ASC")
        List<Object[]> findActiveInstituteCustomFieldsWithNullTypeId(
                        @Param("instituteId") String instituteId,
                        @Param("status") String status);

        @Modifying
        @Transactional
        @Query("UPDATE InstituteCustomField icf SET icf.status = :status WHERE icf.instituteId = :instituteId AND icf.type = :type AND icf.customFieldId = :customFieldId")
        int updateStatusByInstituteIdAndTypeAndCustomFieldId(
                        @Param("instituteId") String instituteId,
                        @Param("type") String type,
                        @Param("customFieldId") String customFieldId,
                        @Param("status") String status);

        @Query("SELECT DISTINCT icf, cf FROM InstituteCustomField icf, CustomFields cf " +
                        "WHERE cf.id = icf.customFieldId " +
                        "AND icf.instituteId = :instituteId " +
                        "AND icf.status = :status " +
                        "ORDER BY cf.formOrder ASC")
        List<Object[]> findUniqueActiveCustomFieldsByInstituteId(
                        @Param("instituteId") String instituteId,
                        @Param("status") String status);

        @Query(value = """
                SELECT icf.* FROM institute_custom_fields icf
                JOIN custom_fields cf ON cf.id = icf.custom_field_id
                WHERE icf.institute_id = :instituteId
                AND cf.field_name = :fieldName
                AND icf.status = 'ACTIVE'
                """,nativeQuery = true)
        Optional<InstituteCustomField> findByInstituteIdAndFieldName(@Param("instituteId") String instituteId,
                                                                     @Param("fieldName") String fieldName);

    Optional<InstituteCustomField> findTopByInstituteIdAndCustomFieldIdAndTypeAndTypeIdAndStatusOrderByCreatedAtDesc(
            String instituteId,
            String fieldId,
            String type,
            String typeId,
            String status
    );

    List<InstituteCustomField> findByInstituteIdAndTypeAndTypeIdAndStatusIn(String instituteId, String type, String typeId, List<String> status);

        List<InstituteCustomField> findByInstituteIdAndCustomFieldIdInAndStatusIn(String instituteId, List<String> list, List<String> status);
}
