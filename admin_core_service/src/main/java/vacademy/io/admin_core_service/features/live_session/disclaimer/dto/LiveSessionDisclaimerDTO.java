package vacademy.io.admin_core_service.features.live_session.disclaimer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What the learner app needs to decide whether to play the disclaimer. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LiveSessionDisclaimerDTO {

    /** true only when a video is configured AND this learner has not acknowledged it. */
    private boolean required;

    /** Absent when nothing is required, so the client has nothing to render. */
    private String videoUrl;
}
