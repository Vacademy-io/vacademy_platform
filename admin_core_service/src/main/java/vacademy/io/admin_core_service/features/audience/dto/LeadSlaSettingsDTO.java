package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Flat read/write shape for the lead SLA settings UI (GET/PUT). The fixed trigger keys/stages
 * are applied server-side; the UI only deals with on/off, durations, before-windows and roles.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadSlaSettingsDTO {
    private boolean tatEnabled;
    private Integer tatHours;
    /** "remind N minutes before the TAT deadline" windows (multiple allowed). */
    private List<Integer> tatBeforeMinutes;
    private List<String> tatNotifyRoles;

    private boolean followupEnabled;
    private Integer followupSlaHours;
    private Integer followupRemindBeforeMinutes;
    private List<String> followupNotifyRoles;
}
