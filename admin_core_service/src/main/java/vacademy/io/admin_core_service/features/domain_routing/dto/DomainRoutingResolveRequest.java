package vacademy.io.admin_core_service.features.domain_routing.dto;

import lombok.Data;

@Data
public class DomainRoutingResolveRequest {
    private String domain;
    private String subdomain;
}


