package vacademy.io.auth_service.feature.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstituteInfo {
    private String instituteName;
    private  String country;
    private String state;
    private String city;
    private String address;
    private String pinCode;
    private String email;
    private String phone;
    private String websiteUrl;


}
