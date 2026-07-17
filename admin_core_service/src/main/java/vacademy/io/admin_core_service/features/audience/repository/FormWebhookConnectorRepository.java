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

    /**
     * Find all active connectors for a given vendor (across institutes).
     * Used by the scheduled health monitor to sweep every Meta connector.
     */
    java.util.List<FormWebhookConnector> findByVendorAndIsActiveTrue(String vendor);

    /**
     * Find existing connector by vendor + vendorId (unique constraint).
     * Used by the save-connector endpoint to upsert instead of always inserting.
     */
    java.util.Optional<FormWebhookConnector> findByVendorAndVendorId(String vendor, String vendorId);

    /**
     * Find connector by platform form ID and vendor — used for ad platform webhooks.
     * Meta sends form_id in webhook payload; Google sends campaign_id as google_key context.
     */
    java.util.Optional<FormWebhookConnector> findByPlatformFormIdAndVendorAndIsActiveTrue(
            String platformFormId, String vendor);

    /**
     * Advance ONLY the poll cursor columns for one connector. The poller loads the
     * entity outside a transaction and, after slow Graph calls, would otherwise
     * {@code save()} a stale full-row snapshot that clobbers columns another
     * scheduler wrote in the meantime (e.g. a freshly-rotated oauth_access_token_enc
     * from MetaTokenRefreshJob, or connection_status from the monitor). This targeted
     * write touches only the disjoint columns the poller owns. last_polled_lead_id is
     * kept when {@code leadId} is null so a poll that returned nothing doesn't erase it.
     */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
        "UPDATE FormWebhookConnector c SET c.lastPolledAt = :ts, " +
        "c.lastPolledLeadId = COALESCE(:leadId, c.lastPolledLeadId) WHERE c.id = :id")
    void updatePollCursor(
            @org.springframework.data.repository.query.Param("id") String id,
            @org.springframework.data.repository.query.Param("ts") java.time.LocalDateTime ts,
            @org.springframework.data.repository.query.Param("leadId") String leadId);

    /**
     * Find all active connectors for a given vendor where tokens are expiring soon.
     * Used by MetaTokenRefreshJob to proactively refresh tokens.
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT c FROM FormWebhookConnector c WHERE c.vendor = :vendor " +
        "AND c.isActive = true AND c.connectionStatus = 'ACTIVE' " +
        "AND c.oauthTokenExpiresAt IS NOT NULL " +
        "AND c.oauthTokenExpiresAt < :expiryThreshold")
    java.util.List<FormWebhookConnector> findExpiringTokenConnectors(
            @org.springframework.data.repository.query.Param("vendor") String vendor,
            @org.springframework.data.repository.query.Param("expiryThreshold") java.time.LocalDateTime expiryThreshold);

    /**
     * Connectors that still need a form-name backfill: same vendor, has a
     * form ID and an active token, but platform_form_name is null/blank.
     * Used by the one-time backfill endpoint that calls Meta Graph API to
     * populate platform_form_name on connectors created before that column
     * existed.
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT c FROM FormWebhookConnector c WHERE c.vendor = :vendor " +
        "AND c.isActive = true " +
        "AND c.platformFormId IS NOT NULL " +
        "AND c.oauthAccessTokenEnc IS NOT NULL " +
        "AND (c.platformFormName IS NULL OR c.platformFormName = '')")
    java.util.List<FormWebhookConnector> findMissingPlatformFormName(
            @org.springframework.data.repository.query.Param("vendor") String vendor);
}
