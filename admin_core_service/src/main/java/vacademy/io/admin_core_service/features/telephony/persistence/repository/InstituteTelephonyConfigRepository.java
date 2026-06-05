package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

import java.util.Optional;

@Repository
public interface InstituteTelephonyConfigRepository
        extends JpaRepository<InstituteTelephonyConfig, String> {

    Optional<InstituteTelephonyConfig> findByInstituteId(String instituteId);

    @Query("""
            SELECT c FROM InstituteTelephonyConfig c
            WHERE c.instituteId = :instituteId AND c.enabled = TRUE
            """)
    Optional<InstituteTelephonyConfig> findEnabledByInstituteId(
            @Param("instituteId") String instituteId);
}
