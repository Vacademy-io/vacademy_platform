package vacademy.io.admin_core_service.features.reporting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** The REPORT_SETTING blob: institutes.setting_json -> setting.REPORT_SETTING.data */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReportSettingConfig {

    private boolean enabled = false;

    /** Day boundaries are resolved here, never in the JVM zone (which stays UTC). */
    private String timezone = "Asia/Kolkata";

    /** Phase 2 ceiling across all schedules. */
    private Integer monthlyCreditCap;

    private List<ReportScheduleConfig> schedules = new ArrayList<>();
}
