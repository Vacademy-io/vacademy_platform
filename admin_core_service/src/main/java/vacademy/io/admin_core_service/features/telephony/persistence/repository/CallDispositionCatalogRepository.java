package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.CallDispositionCatalog;

import java.util.List;
import java.util.Optional;

@Repository
public interface CallDispositionCatalogRepository extends JpaRepository<CallDispositionCatalog, String> {

    long countByInstituteId(String instituteId);

    List<CallDispositionCatalog> findByInstituteIdAndIsActiveTrueOrderByDisplayOrderAsc(String instituteId);

    Optional<CallDispositionCatalog> findByInstituteIdAndDispositionKey(String instituteId, String dispositionKey);
}
