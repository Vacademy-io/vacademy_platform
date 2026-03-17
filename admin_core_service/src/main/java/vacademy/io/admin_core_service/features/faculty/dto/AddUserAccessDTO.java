package vacademy.io.admin_core_service.features.faculty.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AddUserAccessDTO {
    private String userId;
    private String packageSessionId;
    private String subjectId;
    private String status;
    private String name;

    // New fields
    private String userType;
    private String typeId;
    private String accessType;
    private String accessId;
    private String accessPermission;
    private String linkageType;
    private String suborgId;
}
