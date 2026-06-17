package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

@Data
public class UpsertEngineerRequest {
    private String name;
    private String email;
    private String userId;
    private Boolean active;
}
