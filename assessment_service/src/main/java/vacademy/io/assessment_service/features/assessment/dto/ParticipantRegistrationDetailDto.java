package vacademy.io.assessment_service.features.assessment.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ParticipantRegistrationDetailDto {

    private String registrationId;
    private String userId;
    private String participantName;
    private String email;
    private String phoneNumber;
    private String source;
    private String status;
    private Date registrationTime;
    private List<CustomFieldAnswer> customFields;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CustomFieldAnswer {
        private String fieldId;
        private String fieldName;
        private String fieldKey;
        private String fieldType;
        private Integer fieldOrder;
        private Boolean isMandatory;
        private String answer;
    }
}
