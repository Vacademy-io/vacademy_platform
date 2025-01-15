package vacademy.io.common.student.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BasicParticipantDTO {
    private String username;
    private String userId;
    private String email;
    private String fullName;
    private String mobileNumber;
    private String fileId;
    private String guardianEmail;
    private String guardianMobileNumber;
    private Integer reattemptCount;
}