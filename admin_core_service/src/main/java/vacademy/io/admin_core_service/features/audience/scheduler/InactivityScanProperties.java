package vacademy.io.admin_core_service.features.audience.scheduler;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Config for the inactivity opt-out scan. Disabled by default; each institute that wants
 * silent-lead auto opt-out adds a target listing the audiences to watch, the WhatsApp
 * business channel to read message history from, and the silence window.
 *
 * <pre>
 * inactivity-scan:
 *   enabled: true
 *   cron: "0 0 7 * * ?"          # daily, server timezone
 *   targets:
 *     - institute-id: 757d50c5-4e0a-4758-9fc6-ee62479df549
 *       audience-ids: ["&lt;js-challenge-audience-id&gt;"]
 *       sender-business-channel-id: "919579465864"
 *       inactivity-days: 3
 * </pre>
 *
 * Scoped intentionally narrow (per the product decision: Js Challenge participants only),
 * since an opt-out permanently stops all messaging to a lead.
 */
@Component
@ConfigurationProperties(prefix = "inactivity-scan")
@Data
public class InactivityScanProperties {

    /** Master switch. When false the scheduled scan does nothing. */
    private boolean enabled = false;

    private List<Target> targets = new ArrayList<>();

    @Data
    public static class Target {
        /** Institute the leads belong to. */
        private String instituteId;
        /** Audiences whose active leads are eligible for the inactivity check. */
        private List<String> audienceIds = new ArrayList<>();
        /** WhatsApp business channel whose message history defines "no reply". */
        private String senderBusinessChannelId;
        /** A lead with no inbound reply for this many days is opted out. */
        private int inactivityDays = 3;
    }
}
