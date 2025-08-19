package vacademy.io.admin_core_service.features.domain_routing.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingResolveRequest;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingResolveResponse;
import vacademy.io.admin_core_service.features.domain_routing.service.DomainRoutingService;

import java.util.Optional;

@RestController
@RequestMapping("/admin-core-service/public/domain-routing/v1")
@RequiredArgsConstructor
public class DomainRoutingController {

    private final DomainRoutingService domainRoutingService;

    @PostMapping("/resolve")
    public ResponseEntity<DomainRoutingResolveResponse> resolve(@RequestBody DomainRoutingResolveRequest request) {
        Optional<DomainRoutingResolveResponse> response = domainRoutingService.resolve(request.getDomain(), request.getSubdomain());
        return response.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/resolve")
    public ResponseEntity<DomainRoutingResolveResponse> resolveGet(@RequestParam("domain") String domain,
                                                                   @RequestParam("subdomain") String subdomain) {
        Optional<DomainRoutingResolveResponse> response = domainRoutingService.resolve(domain, subdomain);
        return response.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
}


