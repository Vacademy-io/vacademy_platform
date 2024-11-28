package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteInfoDTO {
    private String instituteName;
    private String id;
    private  String country;
    private String state;
    private String city;
    private String address;
    private String pinCode;
    private String phone;
    private String email;
    private String websiteUrl;
}
