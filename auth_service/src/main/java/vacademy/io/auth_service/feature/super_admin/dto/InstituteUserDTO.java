package vacademy.io.auth_service.feature.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteUserDTO {
    private String userId;
    private String fullName;
    private String email;
    private String mobileNumber;
    private String roles;
    private String status;
    private Date lastLoginTime;
    private Date createdAt;
}
