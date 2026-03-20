package vacademy.io.auth_service.feature.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PlatformActivityTrendDTO {
    private Long totalUniqueUsers;
    private Long totalSessions;
    private Long totalApiCalls;
    private List<DailyTrend> dailyTrends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DailyTrend {
        private LocalDate date;
        private Long uniqueUsers;
        private Long totalSessions;
        private Long totalApiCalls;
    }
}
