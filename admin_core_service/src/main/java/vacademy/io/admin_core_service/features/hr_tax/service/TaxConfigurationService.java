package vacademy.io.admin_core_service.features.hr_tax.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_tax.dto.TaxConfigurationDTO;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxConfiguration;
import vacademy.io.admin_core_service.features.hr_tax.repository.TaxConfigurationRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

@Service
public class TaxConfigurationService {

    @Autowired
    private TaxConfigurationRepository taxConfigurationRepository;

    @Transactional
    public String saveConfig(TaxConfigurationDTO dto) {
        // Upsert by instituteId + countryCode
        Optional<TaxConfiguration> existingOpt = taxConfigurationRepository
                .findByInstituteIdAndCountryCode(dto.getInstituteId(), dto.getCountryCode());

        TaxConfiguration config;
        if (existingOpt.isPresent()) {
            config = existingOpt.get();
        } else {
            config = new TaxConfiguration();
            config.setInstituteId(dto.getInstituteId());
            config.setCountryCode(dto.getCountryCode());
        }

        config.setStateCode(dto.getStateCode());
        config.setFinancialYearStartMonth(dto.getFinancialYearStartMonth());
        config.setTaxRules(dto.getTaxRules());
        config.setEmployerContributions(dto.getEmployerContributions());
        config.setStatutorySettings(dto.getStatutorySettings());
        config.setStatus(dto.getStatus() != null ? dto.getStatus() : "ACTIVE");

        config = taxConfigurationRepository.save(config);
        return config.getId();
    }

    @Transactional(readOnly = true)
    public TaxConfigurationDTO getConfig(String instituteId) {
        TaxConfiguration config = taxConfigurationRepository.findByInstituteIdAndStatus(instituteId, "ACTIVE")
                .orElseThrow(() -> new VacademyException("Tax configuration not found for institute"));

        return toDTO(config);
    }

    private TaxConfigurationDTO toDTO(TaxConfiguration config) {
        return TaxConfigurationDTO.builder()
                .id(config.getId())
                .instituteId(config.getInstituteId())
                .countryCode(config.getCountryCode())
                .stateCode(config.getStateCode())
                .financialYearStartMonth(config.getFinancialYearStartMonth())
                .taxRules(config.getTaxRules())
                .employerContributions(config.getEmployerContributions())
                .statutorySettings(config.getStatutorySettings())
                .status(config.getStatus())
                .build();
    }
}
