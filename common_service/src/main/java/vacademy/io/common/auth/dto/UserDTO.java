package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.auth.entity.User;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserDTO {
    private String id;
    private String username;
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
    private String password;
    private String profilePicFileId;
    private List<String> roles;
    private Date lastLoginTime;

    public UserDTO(User user) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.fullName = user.getFullName();
        this.addressLine = user.getAddressLine();
        this.city = user.getCity();
        this.pinCode = user.getPinCode();
        this.mobileNumber = user.getMobileNumber();
        this.dateOfBirth = user.getDateOfBirth();
        this.gender = user.getGender();
        this.isRootUser = user.isRootUser();
        this.profilePicFileId = user.getProfilePicFileId();
        this.setLastLoginTime(user.getLastLoginTime());
        this.roles = user.getRoles().stream().map((ur) -> ur.getRole().getName()).toList();
    }

    public UserDTO(User user, UserDTO userDTO) {
        this.id = user.getId();
        this.username = user.getUsername();
        this.email = user.getEmail();
        this.fullName = user.getFullName();
        this.addressLine = user.getAddressLine();
        this.city = user.getCity();
        this.pinCode = user.getPinCode();
        this.mobileNumber = user.getMobileNumber();
        this.dateOfBirth = user.getDateOfBirth();
        this.gender = user.getGender();
        this.isRootUser = user.isRootUser();
        this.profilePicFileId = user.getProfilePicFileId();
        this.region = userDTO.getRegion();
        this.setLastLoginTime(user.getLastLoginTime());
        this.roles = user.getRoles().stream().map((ur) -> ur.getRole().getName()).toList();

    }
}
