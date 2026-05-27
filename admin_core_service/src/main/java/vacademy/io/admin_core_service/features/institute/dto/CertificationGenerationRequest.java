package vacademy.io.admin_core_service.features.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CertificationGenerationRequest {
    private Date completionDate;
    private String key;
    private String currentHtmlTemplate;

    // Learner's current course completion percentage (0..100) as computed by the
    // learner app. The backend re-validates this against the per-institute
    // auto-issue threshold so the frontend cannot bypass the gate.
    private Integer completionPercentage;

    // Optional human-readable course name passed for audit + email substitution.
    // The backend falls back to the package's name if absent.
    private String courseName;

    // When true, the backend bypasses the cached file id on the learner's
    // session mapping and re-renders the certificate against the *current*
    // template + token substitution code. Used by preview flows and after
    // template edits so a stale cached PDF doesn't keep returning. Defaults
    // to false so production traffic continues to hit the cache.
    private Boolean regenerate;
}
