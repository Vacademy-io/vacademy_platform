package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UserTopLevelDto {
    private String id;
    private String email;
    private String fullName;
    private String addressLine;
    private String city;
    private String region;
    private String pinCode;
    private String mobileNumber;
    private Date dateOfBirth;
    private String gender;
    private boolean isRootUser;
    private String profilePicFileId;
    private List<UserRoleDTO> roles;
    private List<String> deleteUserRoleRequest;
    private List<String> addUserRoleRequest;
}
