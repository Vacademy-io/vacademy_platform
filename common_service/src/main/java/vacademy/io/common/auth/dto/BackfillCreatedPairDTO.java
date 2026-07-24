package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One successfully-created guardian from a backfill chunk — lets the caller stamp its own denormalized pointers. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class BackfillCreatedPairDTO {
    private String childUserId;
    private String parentUserId;
    private String studentFullName;
    private String studentEmail;
    private String guardianFullName;
    private String guardianUsername;
    private String guardianEmail;
    private String guardianPassword;
}
