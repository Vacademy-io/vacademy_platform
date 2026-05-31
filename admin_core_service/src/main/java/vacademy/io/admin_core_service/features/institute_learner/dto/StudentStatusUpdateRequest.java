package vacademy.io.admin_core_service.features.institute_learner.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentStatusUpdateRequest {
    private String userId;
    private String newState;
    private String instituteId;
    private String currentPackageSessionId;

    /**
     * Optional list of package sessions to act on in a single call (MAKE_INACTIVE).
     * When present and non-empty, MAKE_INACTIVE deactivates the learner from every
     * package session in this list with one UPDATE. When absent, the operation
     * falls back to the single {@link #currentPackageSessionId}.
     */
    private List<String> packageSessionIds;
}
