package vacademy.io.admin_core_service.features.learner_offline.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * Server-side mirror of the institute-wide {@code OFFLINE_ACCESS_SETTING} JSON
 * (offline plan, Part A6). Read via OfflineSettingService.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OfflineAccessSettingsPojo {

    public static final int MIN_REVALIDATION_DAYS = 1;
    public static final int MAX_REVALIDATION_DAYS = 90;
    public static final int MIN_MAX_DEVICES = 1;
    public static final int MAX_MAX_DEVICES = 10;

    /** Master flag — false zeroes out every offline permission for the institute. */
    private boolean enabled = false;

    /** Days an offline device can go without a check-in before its lease expires. */
    private int revalidationDays = 7;

    /** Max concurrent ACTIVE offline devices per learner. */
    private int maxDevices = 2;

    public static OfflineAccessSettingsPojo defaults() {
        return new OfflineAccessSettingsPojo();
    }
}
