package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class OfflineDiscrepancyReviewRequest {
    /** Currently only "REVIEWED" is meaningful; kept as a free string so the
     *  admin UI doesn't need a backend change to add a status later. */
    private String status;
}
