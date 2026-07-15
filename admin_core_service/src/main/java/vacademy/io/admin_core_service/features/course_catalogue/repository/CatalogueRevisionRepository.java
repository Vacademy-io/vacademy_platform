package vacademy.io.admin_core_service.features.course_catalogue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueRevision;

import java.util.List;
import java.util.Optional;

public interface CatalogueRevisionRepository extends JpaRepository<CatalogueRevision, String> {

    // IdDesc tiebreaker: equal revision_no rows (pre-fix data) resolve deterministically
    Optional<CatalogueRevision> findFirstByCatalogueIdAndStatusOrderByRevisionNoDescIdDesc(String catalogueId, String status);

    List<CatalogueRevision> findByCatalogueIdAndStatusInOrderByRevisionNoDescIdDesc(String catalogueId, List<String> statuses);

    Optional<CatalogueRevision> findFirstByCatalogueIdOrderByRevisionNoDescIdDesc(String catalogueId);
}
