package vacademy.io.admin_core_service.features.institute.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class InstituteInfoDTO {
    private String instituteName;
    private  String country;
    private String state;
    private String city;
    private String address;
    private String pinCode;
    private String phone;
    private String email;
    private String websiteUrl;


}
