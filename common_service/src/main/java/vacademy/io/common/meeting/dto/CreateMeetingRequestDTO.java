package vacademy.io.common.meeting.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class CreateMeetingRequestDTO {
    private String topic;
    private String agenda;
    /** ISO-8601 datetime string e.g. "2026-03-05T10:00:00+05:30" */
    private String startTime;
    private int durationMinutes;
    private String timezone;
    private String hostEmail;
    /** Vacademy live_session id — used to link the provider meeting back */
    private String sessionId;
    /** Vacademy session_schedule id — used to link the provider meeting back */
    private String scheduleId;

    /**
     * Vendor-neutral meeting settings — the provider's manager interprets the keys.
     * Preferred over the legacy {@code bbbConfig}/{@code zoomConfig} fields so adding
     * a new vendor needs no change to this shared DTO. Read via {@link #resolveProviderConfig()}.
     */
    private Map<String, Object> providerConfig;
    /**
     * Vendor-neutral provider-account selector (e.g. which Zoom account). Read via
     * {@link #resolveProviderAccountId()}. Preferred over the legacy {@code zoomAccountId}.
     */
    private String providerAccountId;

    /** @deprecated use {@link #providerConfig}. Kept for backward compatibility during transition. */
    @Deprecated
    private Map<String, Object> bbbConfig;
    /** @deprecated use {@link #providerAccountId}. Kept for backward compatibility during transition. */
    @Deprecated
    private String zoomAccountId;
    /** @deprecated use {@link #providerConfig}. Kept for backward compatibility during transition. */
    @Deprecated
    private Map<String, Object> zoomConfig;

    /** Provider settings, preferring the generic field and falling back to the legacy per-vendor maps. */
    public Map<String, Object> resolveProviderConfig() {
        if (providerConfig != null && !providerConfig.isEmpty()) {
            return providerConfig;
        }
        if (zoomConfig != null) {
            return zoomConfig;
        }
        return bbbConfig;
    }

    /** Provider-account id, preferring the generic field and falling back to the legacy zoom field. */
    public String resolveProviderAccountId() {
        return (providerAccountId != null && !providerAccountId.isBlank())
                ? providerAccountId
                : zoomAccountId;
    }
}
