package vacademy.io.admin_core_service.features.live_session.provider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Request body for creating a provider meeting tied to a live session schedule.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProviderMeetingCreateRequestDTO {
    private String instituteId;
    private String sessionId;
    private String scheduleId;
    private String topic;
    private String agenda;
    /** ISO-8601 datetime e.g. "2026-03-05T10:00:00+05:30" */
    private String startTime;
    private int durationMinutes;
    private String timezone;
    private String hostEmail;
    /**
     * Provider to use. If null, defaults to the institute's connected provider.
     * e.g. "ZOHO_MEETING"
     */
    private String provider;

    /** Vendor-neutral meeting settings — preferred over the legacy per-vendor maps. */
    private Map<String, Object> providerConfig;
    /** Vendor-neutral provider-account selector — preferred over the legacy zoomAccountId. */
    private String providerAccountId;

    /** @deprecated use {@link #providerConfig}. */
    @Deprecated
    private Map<String, Object> bbbConfig;
    /** @deprecated use {@link #providerAccountId}. */
    @Deprecated
    private String zoomAccountId;
    /** @deprecated use {@link #providerConfig}. */
    @Deprecated
    private Map<String, Object> zoomConfig;

    /** Provider settings, preferring the generic field, falling back to the legacy per-vendor maps. */
    public Map<String, Object> resolveProviderConfig() {
        if (providerConfig != null && !providerConfig.isEmpty()) {
            return providerConfig;
        }
        if (zoomConfig != null) {
            return zoomConfig;
        }
        return bbbConfig;
    }

    /** Provider-account id, preferring the generic field, falling back to the legacy zoom field. */
    public String resolveProviderAccountId() {
        return (providerAccountId != null && !providerAccountId.isBlank())
                ? providerAccountId
                : zoomAccountId;
    }
}
