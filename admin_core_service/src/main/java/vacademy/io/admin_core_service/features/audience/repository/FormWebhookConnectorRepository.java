package vacademy.io.admin_core_service.features.audience.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;

import java.util.Optional;

/**
 * Repository for FormWebhookConnector entity
 */
@Repository
public interface FormWebhookConnectorRepository extends JpaRepository<FormWebhookConnector, String> {
    
    /**
     * Find connector by vendor type and vendor ID
     * This is the primary lookup method when a webhook is received
     *
     * @param vendorId Unique identifier from the form provider
     * @return FormWebhookConnector if found
     */
    Optional<FormWebhookConnector> findByVendorIdAndIsActiveTrue(String vendorId);
    
    /**
     * Find all connectors for a specific audience
     * 
     * @param audienceId Audience/campaign ID
     * @return List of connectors
     */
    java.util.List<FormWebhookConnector> findByAudienceIdAndIsActiveTrue(String audienceId);
    
    /**
     * Find all connectors for a specific institute
     * 
     * @param instituteId Institute ID
     * @return List of connectors
     */
    java.util.List<FormWebhookConnector> findByInstituteIdAndIsActiveTrue(String instituteId);
}
