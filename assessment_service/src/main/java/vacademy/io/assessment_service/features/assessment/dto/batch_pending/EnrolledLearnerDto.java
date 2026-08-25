package vacademy.io.assessment_service.features.assessment.dto.batch_pending;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One batch-enrolled learner, as returned by admin_core's
 * {@code /internal/learner/v1/enrolled-by-package-sessions}.
 *
 * <p>admin_core serialises the projection with SnakeCaseStrategy, so snake_case is the
 * expected wire form. Each field also accepts the camelCase spelling: this is a
 * cross-service contract, and if the two ever disagree the failure is silent — Jackson
 * leaves the fields null and the tab renders nameless rows instead of erroring. Accepting
 * both costs nothing and removes that failure mode entirely.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnrolledLearnerDto {

    @JsonProperty("user_id")
    @JsonAlias("userId")
    private String userId;

    @JsonProperty("full_name")
    @JsonAlias("fullName")
    private String fullName;

    @JsonProperty("package_session_id")
    @JsonAlias("packageSessionId")
    private String packageSessionId;
}
