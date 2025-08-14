package vacademy.io.admin_core_service.features.domain_routing.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingUpsertRequest;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.domain_routing.service.DomainRoutingAdminService;

import java.util.Optional;

@RestController
@RequestMapping("/admin-core-service/admin/domain-routing/v1")
@RequiredArgsConstructor
public class DomainRoutingAdminController {

    private final DomainRoutingAdminService service;
    private final InstituteDomainRoutingRepository repository;

    @PostMapping
    public ResponseEntity<InstituteDomainRouting> create(@RequestBody DomainRoutingUpsertRequest request) {
        return ResponseEntity.ok(service.create(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<InstituteDomainRouting> get(@PathVariable String id) {
        Optional<InstituteDomainRouting> entity = service.get(id);
        return entity.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<InstituteDomainRouting> update(@PathVariable String id, @RequestBody DomainRoutingUpsertRequest request) {
        return service.update(id, request)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/by-institute/{instituteId}")
    public ResponseEntity<Iterable<InstituteDomainRouting>> listByInstitute(@PathVariable String instituteId) {
        return ResponseEntity.ok(repository.findByInstituteId(instituteId));
    }
}


