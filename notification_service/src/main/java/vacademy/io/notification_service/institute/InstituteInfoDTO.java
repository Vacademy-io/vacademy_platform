package vacademy.io.notification_service.institute;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
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
