package vacademy.io.admin_core_service.features.common.enums;

/**
 * Defines the synchronization direction between system fields and custom fields.
 */
public enum SyncDirectionEnum {
    /**
     * Changes sync both ways - system field updates custom field and vice versa.
     */
    BIDIRECTIONAL,
    
    /**
     * Only custom field changes update the system field.
     * System field changes do NOT propagate to custom field.
     */
    TO_SYSTEM,
    
    /**
     * Only system field changes update the custom field.
     * Custom field changes do NOT propagate to system field.
     */
    TO_CUSTOM,
    
    /**
     * No automatic sync. Manual sync only.
     */
    NONE
}
