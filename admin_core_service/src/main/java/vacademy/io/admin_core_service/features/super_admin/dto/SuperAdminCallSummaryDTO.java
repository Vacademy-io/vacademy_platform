package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Totals for whatever the user has filtered to — the strip above the table. */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class SuperAdminCallSummaryDTO {
    private long calls;
    private double minutes;
    private double costInr;
    private double billedInr;
    private double marginInr;
    private Double marginPct;
    private long red;
    private long amber;
    private long green;
    private long withRecording;
    private java.util.Map<String, Double> costBreakdown;
    private java.util.Map<String, Long> byTtsModel;
    private Boolean costIsModelled;
}
