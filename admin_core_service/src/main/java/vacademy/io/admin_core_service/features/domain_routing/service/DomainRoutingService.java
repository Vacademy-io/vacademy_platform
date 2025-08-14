package vacademy.io.admin_core_service.features.domain_routing.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingResolveResponse;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DomainRoutingService {

    private final InstituteDomainRoutingRepository routingRepository;
    private final InstituteRepository instituteRepository;

    public Optional<DomainRoutingResolveResponse> resolve(String domain, String subdomain) {
        if (!StringUtils.hasText(domain) || !StringUtils.hasText(subdomain)) {
            return Optional.empty();
        }

        Optional<InstituteDomainRouting> mappingOpt = routingRepository.resolveMapping(domain.trim(), subdomain.trim());
        if (mappingOpt.isEmpty()) {
            return Optional.empty();
        }

        InstituteDomainRouting mapping = mappingOpt.get();
        Optional<Institute> instituteOpt = instituteRepository.findById(mapping.getInstituteId());
        if (instituteOpt.isEmpty()) {
            return Optional.empty();
        }

        Institute institute = instituteOpt.get();
        DomainRoutingResolveResponse response = DomainRoutingResolveResponse.builder()
                .instituteId(institute.getId())
                .instituteName(institute.getInstituteName())
                .instituteLogoFileId(institute.getLogoFileId())
                .instituteThemeCode(institute.getInstituteThemeCode())
                .role(mapping.getRole())
                .build();
        return Optional.of(response);
    }
}


