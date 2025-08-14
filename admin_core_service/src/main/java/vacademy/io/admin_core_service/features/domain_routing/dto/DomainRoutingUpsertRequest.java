package vacademy.io.admin_core_service.features.domain_routing.dto;

import lombok.Data;

@Data
public class DomainRoutingUpsertRequest {
    private String domain;
    private String subdomain;
    private String role;
    private String instituteId;
}


