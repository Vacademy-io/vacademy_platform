package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallingConfig;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiCallingConfigRepository extends JpaRepository<AiCallingConfig, String> {

    /** The active account for placing calls / verifying webhooks for this provider. */
    Optional<AiCallingConfig> findFirstByInstituteIdAndProviderAndEnabledTrueOrderByUpdatedAtDesc(
            String instituteId, String provider);

    /** Upsert key — one row per account (company code) per (institute, provider). */
    Optional<AiCallingConfig> findByInstituteIdAndProviderAndCompanyCode(
            String instituteId, String provider, String companyCode);

    List<AiCallingConfig> findByInstituteIdAndProvider(String instituteId, String provider);
}
