package vacademy.io.auth_service.feature.institute.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateInstituteSettingsDTO {
    private String instituteId;
    private String userIdentifier;
    private String settingsJson;
}
