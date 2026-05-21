package vacademy.io.admin_core_service.features.ai_content.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_content.entity.AiContentSource;

import java.util.Optional;

@Repository
public interface AiContentSourceRepository extends JpaRepository<AiContentSource, String> {

    /** Locate the canonical row for a given source artifact (e.g. a BBB recording). */
    Optional<AiContentSource> findBySourceTypeAndSourceId(String sourceType, String sourceId);
}
