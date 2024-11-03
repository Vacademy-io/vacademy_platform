package vacademy.io.auth_service.feature.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.auth_service.feature.user.enums.Gender;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {

    private String id;
    private String username;
    private String email;
    private String fullName;
    private String addressLine;
    private String city;
    private String pinCode;
    private String mobileNumber;
    private LocalDate dateOfBirth;
    private Gender gender;
    private boolean isRootUser;
}
