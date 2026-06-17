package vacademy.io.community_service.feature.support.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The institute-facing view of its own support setup: which plan it's on (with full SLA detail),
 * the names of any dedicated engineers, and a count of its open tickets.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupportConfigDto {
    private String instituteId;
    private SupportPlanDto plan;
    private List<String> dedicatedEngineerNames;
    private long openTicketCount;
}
