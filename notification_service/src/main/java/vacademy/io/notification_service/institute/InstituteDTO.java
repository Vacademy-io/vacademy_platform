package vacademy.io.notification_service.institute;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class InstituteDTO {
    private String id;
    private String instituteName;
    private String address;
    private String instituteThemeCode;
    private String setting;
    private String websiteUrl;
}
