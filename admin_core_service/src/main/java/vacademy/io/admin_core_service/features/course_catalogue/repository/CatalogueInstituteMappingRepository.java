package vacademy.io.admin_core_service.features.course_catalogue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueInstituteMapping;

import java.util.List;
import java.util.Optional;

@Repository
public interface CatalogueInstituteMappingRepository extends JpaRepository<CatalogueInstituteMapping, String> {

        List<CatalogueInstituteMapping> findByInstituteIdAndStatusIn(String instituteId, List<String> name);

        List<CatalogueInstituteMapping> findByInstituteIdAndSourceAndSourceIdAndStatusIn(String instituteId,
                        String source, String sourceId, List<String> name);

        @Query(value = "SELECT * FROM catalogue_institute_mapping " +
                        "WHERE institute_id = :instituteId " +
                        "AND status IN (:status) " +
                        "AND is_default = true " +
                        "LIMIT 1", nativeQuery = true)
        Optional<CatalogueInstituteMapping> findDefaultCatalogueForInstituteId(@Param("instituteId") String instituteId,
                        @Param("status") List<String> status);

        Optional<CatalogueInstituteMapping> findByCourseCatalogueId(String courseCatalogueId);

        @Query(value = "SELECT cim.* FROM catalogue_institute_mapping cim " +
                        "JOIN course_catalogue cc ON cc.id = cim.course_catalogue " +
                        "WHERE cim.institute_id = :instituteId AND cc.tag_name = :tagName " +
                        "AND cim.status IN (:status) LIMIT 1", nativeQuery = true)
        Optional<CatalogueInstituteMapping> findByInstituteIdAndTagName(@Param("instituteId") String instituteId,
                        @Param("tagName") String tagName,
                        @Param("status") List<String> status);

}
