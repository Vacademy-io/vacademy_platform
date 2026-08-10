package vacademy.io.admin_core_service.features.audience.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SelfSignupLeadRequestDTO {
    private String userId;
    private String instituteId;
    private String name;
    private String email;
    private String mobile;
}
