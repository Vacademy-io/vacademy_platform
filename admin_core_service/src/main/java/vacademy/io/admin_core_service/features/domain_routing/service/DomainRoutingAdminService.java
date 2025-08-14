package vacademy.io.admin_core_service.features.domain_routing.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingUpsertRequest;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DomainRoutingAdminService {

    private final InstituteDomainRoutingRepository repository;

    public InstituteDomainRouting create(DomainRoutingUpsertRequest request) {
        validate(request);
        InstituteDomainRouting entity = InstituteDomainRouting.builder()
                .domain(request.getDomain().trim())
                .subdomain(request.getSubdomain().trim())
                .role(request.getRole().trim())
                .instituteId(request.getInstituteId().trim())
                .build();
        return repository.save(entity);
    }

    public Optional<InstituteDomainRouting> get(String id) {
        return repository.findById(id);
    }

    public Optional<InstituteDomainRouting> update(String id, DomainRoutingUpsertRequest request) {
        validate(request);
        return repository.findById(id).map(existing -> {
            existing.setDomain(request.getDomain().trim());
            existing.setSubdomain(request.getSubdomain().trim());
            existing.setRole(request.getRole().trim());
            existing.setInstituteId(request.getInstituteId().trim());
            return repository.save(existing);
        });
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    private void validate(DomainRoutingUpsertRequest request) {
        if (!StringUtils.hasText(request.getDomain()) || !StringUtils.hasText(request.getSubdomain())
                || !StringUtils.hasText(request.getRole()) || !StringUtils.hasText(request.getInstituteId())) {
            throw new IllegalArgumentException("All fields domain, subdomain, role, instituteId are required");
        }
    }
}


