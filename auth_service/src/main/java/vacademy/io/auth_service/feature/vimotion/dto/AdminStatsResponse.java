package vacademy.io.auth_service.feature.vimotion.dto;

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
public class AdminStatsResponse {
    private long waitlistTotal;
    private long waitlistPending;
    private long waitlistInvited;
    private long waitlistConverted;
    private long waitlistRejected;
    private long invitesActive;
    private long invitesExhausted;
    private long invitesRevoked;
    private double conversionRate;
    private List<TopReferrer> topReferrers;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TopReferrer {
        private String id;
        private String fullName;
        private String referralCode;
        private Integer referralCount;
    }
}
