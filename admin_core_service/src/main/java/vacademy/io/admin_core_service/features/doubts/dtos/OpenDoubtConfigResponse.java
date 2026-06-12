package vacademy.io.admin_core_service.features.doubts.dtos;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Public (unauthenticated) view of an institute's query-intake config — consumed by the learner
 * login page to decide whether to show the guest "Need help?" button and which types a guest can
 * pick. Deliberately exposes nothing beyond the gate flags and type labels.
 */
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OpenDoubtConfigResponse {

    private LearnerQueryFlags learnerQuery;

    @Builder.Default
    private List<QueryTypeOption> queryTypes = new ArrayList<>();

    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class LearnerQueryFlags {
        private boolean enabled;
        private boolean allowGuest;
    }

    @JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class QueryTypeOption {
        private String key;
        private String label;
    }

    public static OpenDoubtConfigResponse disabled() {
        return OpenDoubtConfigResponse.builder()
                .learnerQuery(new LearnerQueryFlags(false, false))
                .build();
    }
}
