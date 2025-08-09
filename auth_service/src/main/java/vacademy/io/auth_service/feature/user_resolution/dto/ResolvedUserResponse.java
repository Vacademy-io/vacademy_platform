package vacademy.io.auth_service.feature.user_resolution.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResolvedUserResponse {
    private String id;
    private String email;
    private String mobileNumber;
    private String fullName;
}


