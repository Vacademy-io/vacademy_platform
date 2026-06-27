package vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentIdentitySection {

    // Internal only — not exposed in the sample JSON output
    @JsonIgnore
    private boolean available;

    @JsonIgnore
    private String userId;

    private String name;
    private String enrollmentNo;
    private String batch;

    /** "class" is a reserved Java keyword — use @JsonProperty to emit the right key. */
    @JsonProperty("class")
    private String classs;

    /** Alias for enrollmentNo; use enrollmentNo as fallback when roll_no not separately tracked. */
    private String rollNo;

    /** Profile avatar URL. Null when no avatar uploaded. */
    private String avatarUrl;

    // Internal metadata — still collected but not serialized in the v2 report
    @JsonIgnore
    private String enrolledDate;

    @JsonIgnore
    private String status;

    @JsonIgnore
    private String parentsEmail;

    @JsonIgnore
    private String guardianEmail;
}
