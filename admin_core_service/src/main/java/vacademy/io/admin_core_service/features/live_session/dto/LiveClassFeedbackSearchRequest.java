package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/**
 * Request body for the cross-session live-class feedback search
 * (POST /admin-core-service/live-session-report/feedback/search).
 * Empty {@code batchIds}/{@code subjects} mean "all".
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LiveClassFeedbackSearchRequest {

    private String instituteId;

    // Sessions assigned to any of these batches (package_session ids). Empty = all.
    private List<String> batchIds;

    // Live-class subjects (live_session.subject). Empty = all.
    private List<String> subjects;

    // Meeting-date range filter (inclusive).
    private LocalDate startDate;
    private LocalDate endDate;

    // Optional free-text search across learner name and live-class title.
    private String searchQuery;

    private Integer page = 0;
    private Integer size = 20;
}
