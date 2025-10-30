package vacademy.io.common.auth.dto.learner;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class LearnerExtraDetails {
    private String fathersName;
    private String mothersName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private String parentsToMotherMobileNumber;
    private String parentsToMotherEmail;
    private String linkedInstituteName;
}
