package vacademy.io.admin_core_service.features.domain_routing.dto;

import lombok.Data;

@Data
public class DomainRoutingUpsertRequest {
    private String domain;
    private String subdomain;
    private String role;
    private String instituteId;
    private String redirect;
    private String privacyPolicyUrl;
    private String afterLoginRoute;
    private String termsAndConditionUrl;
    private String theme;
    private String tabText;
    private Boolean allowSignup;
    private String tabIconFileId;
    private String fontFamily;
}


