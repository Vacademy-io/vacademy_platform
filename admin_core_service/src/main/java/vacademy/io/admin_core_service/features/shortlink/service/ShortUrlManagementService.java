package vacademy.io.admin_core_service.features.shortlink.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Central service for managing short URL lifecycle across all entities
 * (EnrollInvite, CouponCode, etc.)
 * 
 * This service provides a unified interface for:
 * - Creating short URLs
 * - Updating short URLs when entity data changes
 * - Deleting short URLs when entities are deleted
 */
@Service
public class ShortUrlManagementService {

    private static final Logger logger = LoggerFactory.getLogger(ShortUrlManagementService.class);

    @Autowired
    private ShortLinkIntegrationService shortLinkIntegrationService;

    /**
     * Creates a short URL for any entity
     * 
     * @param destinationUrl The full URL where the short link should redirect
     * @param source         The entity type (e.g., "ENROLL_INVITE", "COUPON_CODE")
     * @param sourceId       The unique ID of the entity
     * @return The generated short URL, or null if creation failed
     */
    public String createShortUrl(String destinationUrl, String source, String sourceId) {
        try {
            String shortCode = shortLinkIntegrationService.generateRandomCode();
            String shortUrl = shortLinkIntegrationService.createShortLink(
                    shortCode,
                    destinationUrl,
                    source,
                    sourceId);
            logger.info("Created short URL for {} with ID: {}", source, sourceId);
            return shortUrl;
        } catch (Exception e) {
            logger.error("Failed to create short URL for {} with ID: {}", source, sourceId, e);
            return null;
        }
    }

    /**
     * Updates the destination URL for an existing short link
     * 
     * @param newDestinationUrl The new destination URL
     * @param source            The entity type (e.g., "ENROLL_INVITE",
     *                          "COUPON_CODE")
     * @param sourceId          The unique ID of the entity
     * @param currentShortUrl   The current short URL (to check if it exists)
     * @return true if update was successful, false otherwise
     */
    public boolean updateShortUrl(String newDestinationUrl, String source, String sourceId, String currentShortUrl) {
        // Only update if a short URL exists
        if (currentShortUrl == null || currentShortUrl.isEmpty()) {
            logger.debug("No existing short URL to update for {} with ID: {}", source, sourceId);
            return false;
        }

        try {
            shortLinkIntegrationService.updateShortLink(source, sourceId, newDestinationUrl);
            logger.info("Updated short URL for {} with ID: {}", source, sourceId);
            return true;
        } catch (Exception e) {
            logger.error("Failed to update short URL for {} with ID: {}", source, sourceId, e);
            return false;
        }
    }

    /**
     * Deletes (soft-deletes) a short URL when the entity is deleted
     * 
     * @param source          The entity type (e.g., "ENROLL_INVITE", "COUPON_CODE")
     * @param sourceId        The unique ID of the entity
     * @param currentShortUrl The current short URL (to check if it exists)
     * @return true if deletion was successful, false otherwise
     */
    public boolean deleteShortUrl(String source, String sourceId, String currentShortUrl) {
        // Only delete if a short URL exists
        if (currentShortUrl == null || currentShortUrl.isEmpty()) {
            logger.debug("No existing short URL to delete for {} with ID: {}", source, sourceId);
            return false;
        }

        try {
            shortLinkIntegrationService.deleteShortLink(source, sourceId);
            logger.info("Deleted short URL for {} with ID: {}", source, sourceId);
            return true;
        } catch (Exception e) {
            logger.error("Failed to delete short URL for {} with ID: {}", source, sourceId, e);
            return false;
        }
    }

    /**
     * Creates or updates a short URL (upsert operation)
     * Useful when you're not sure if a short URL already exists
     * 
     * @param destinationUrl  The destination URL
     * @param source          The entity type
     * @param sourceId        The unique ID of the entity
     * @param currentShortUrl The current short URL (null if creating new)
     * @return The short URL (existing or newly created)
     */
    public String createOrUpdateShortUrl(String destinationUrl, String source, String sourceId,
            String currentShortUrl) {
        if (currentShortUrl == null || currentShortUrl.isEmpty()) {
            // Create new short URL
            return createShortUrl(destinationUrl, source, sourceId);
        } else {
            // Update existing short URL
            boolean updated = updateShortUrl(destinationUrl, source, sourceId, currentShortUrl);
            return updated ? currentShortUrl : null;
        }
    }
}
