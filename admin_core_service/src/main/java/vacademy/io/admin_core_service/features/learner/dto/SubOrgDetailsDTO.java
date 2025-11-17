package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO containing sub-organization (purchasing institute) details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubOrgDetailsDTO {
    private String id;
    private String name;
    private String email;
    private String mobileNumber;
    private String address;
    private String city;
    private String state;
    private String country;
    private String pincode;
    private String websiteUrl;
    private String status;
}
