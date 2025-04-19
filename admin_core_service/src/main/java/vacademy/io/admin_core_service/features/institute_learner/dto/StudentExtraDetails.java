package vacademy.io.admin_core_service.features.institute_learner.dto;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentExtraDetails {
    private String fathersName;
    private String mothersName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String parentsToMotherMobileNumber;
    private String parentsToMotherEmail;
    private String linkedInstituteName;
}
