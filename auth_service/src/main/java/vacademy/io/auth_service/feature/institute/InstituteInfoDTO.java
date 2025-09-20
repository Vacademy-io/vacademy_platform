package vacademy.io.auth_service.feature.institute;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class InstituteInfoDTO {
    private String id;
    private String instituteName;
    private String address;
    private String instituteThemeCode;
    private String setting;
    private String websiteUrl;
    private String learnerPortalUrl;
    private String adminPortalUrl;
}
