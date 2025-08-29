package vacademy.io.admin_core_service.features.workflow.service;

public interface DedupeService {
    /**
     * Check if an operation key has been seen before
     */
    boolean seen(String key);

    /**
     * Remember an operation key to prevent duplicate processing
     */
    void remember(String key);
}