package vacademy.io.admin_core_service.features.tutorial_guide.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request for rendering a learner-app how-to guide to PDF. The caller (admin
 * dashboard or learner app) composes the branded HTML client-side — sections
 * follow the tutorial checkpoints enabled in Student Display settings — and
 * this endpoint only converts it to a downloadable PDF.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TutorialGuidePdfRequest {

    @NotBlank(message = "html is required")
    private String html;

    @JsonProperty("file_name")
    private String fileName;
}
