package vacademy.io.admin_core_service.features.migration.dto.v2;

/**
 * Status enum for import operations
 */
public enum ImportStatus {
    SUCCESS, // Successfully imported
    FAILED, // Failed to import
    SKIPPED, // Skipped (e.g., already exists and skip_existing=true)
    VALIDATED // Validated only (dry run mode)
}
