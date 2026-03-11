package vacademy.io.admin_core_service.features.hr_tax.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxConfiguration;

import java.util.Optional;

@Repository
public interface TaxConfigurationRepository extends JpaRepository<TaxConfiguration, String> {

    Optional<TaxConfiguration> findByInstituteIdAndCountryCode(String instituteId, String countryCode);

    Optional<TaxConfiguration> findByInstituteIdAndStatus(String instituteId, String status);

    Optional<TaxConfiguration> findByInstituteId(String instituteId);
}
