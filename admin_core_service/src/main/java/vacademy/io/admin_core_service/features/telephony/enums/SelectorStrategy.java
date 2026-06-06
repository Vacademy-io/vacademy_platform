package vacademy.io.admin_core_service.features.telephony.enums;

public final class SelectorStrategy {
    public static final String STICKY_PER_LEAD = "STICKY_PER_LEAD";
    public static final String ROUND_ROBIN     = "ROUND_ROBIN";
    public static final String REGION_MATCH    = "REGION_MATCH";

    private SelectorStrategy() {}
}
