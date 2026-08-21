package vacademy.io.admin_core_service.features.reporting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * One schedule inside REPORT_SETTING. A schedule — not "the report" — is the unit
 * of configuration: an institute can run a weekly academic digest to admins and a
 * monthly finance summary to the owner from the same machinery.
 *
 * Unknown JSON properties are ignored so a newer front-end can save fields this
 * version does not understand without breaking every scheduled run.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReportScheduleConfig {

    private String id;
    private String name;
    private boolean enabled = true;

    /** daily | weekly | monthly */
    private String frequency = "weekly";

    /** MON..SUN, weekly only. */
    private String dayOfWeek = "MON";

    /** 1..28, monthly only. Capped at 28 so every month has the day. */
    private int dayOfMonth = 1;

    /** 0..23, in the institute's timezone. */
    private int hour = 8;

    private List<String> sections = new ArrayList<>();

    /** INSTITUTE | BATCH | SUBJECT | FACULTY. Phase 0 honours INSTITUTE only. */
    private String scopeType = "INSTITUTE";

    private List<String> scopeIds = new ArrayList<>();

    private Recipients recipients = new Recipients();

    /**
     * Do not send (and, once billing exists, do not charge) when every section
     * came back empty. Defaults ON: an institute that receives "nothing happened"
     * every week, and pays for it, turns reports off and resents them.
     */
    private boolean skipIfNoData = true;

    /** Phase 2. Present now so saved config survives the upgrade. */
    private Ai ai = new Ai();

    private Integer creditCapPerRun;

    /**
     * Shallow copy, so a manual run can carry a distinct id without mutating the
     * schedule the institute actually saved.
     */
    public ReportScheduleConfig copy() {
        ReportScheduleConfig c = new ReportScheduleConfig();
        c.id = this.id;
        c.name = this.name;
        c.enabled = this.enabled;
        c.frequency = this.frequency;
        c.dayOfWeek = this.dayOfWeek;
        c.dayOfMonth = this.dayOfMonth;
        c.hour = this.hour;
        c.sections = new ArrayList<>(this.sections == null ? List.of() : this.sections);
        c.scopeType = this.scopeType;
        c.scopeIds = new ArrayList<>(this.scopeIds == null ? List.of() : this.scopeIds);
        c.recipients = this.recipients;
        c.skipIfNoData = this.skipIfNoData;
        c.ai = this.ai;
        c.creditCapPerRun = this.creditCapPerRun;
        return c;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Recipients {
        private List<String> roles = new ArrayList<>();
        private List<String> userIds = new ArrayList<>();
        // Deliberately no `emails` field. Reports name learners, and a typed-in
        // address sits outside the permission model entirely — there would be no
        // answer to "who received this". Platform users only.
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Ai {
        private boolean enabled = false;
        private String depth = "summary";
    }
}
