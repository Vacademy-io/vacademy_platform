package vacademy.io.admin_core_service.features.domain_routing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NamingOverridesDto {
    private String course;
    private String coursePlural;
}
