package vacademy.io.notification_service.features.bounced_emails.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.notification_service.features.bounced_emails.entity.BouncedEmail;
import vacademy.io.notification_service.features.bounced_emails.repository.BouncedEmailRepository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Service for managing bounced email blocklist.
 * Provides methods to check, add, and manage blocked email addresses.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BouncedEmailService {

    private final BouncedEmailRepository bouncedEmailRepository;

    /**
     * Simple in-memory cache for blocked email lookups to reduce database hits.
     * Cache entries expire after 5 minutes.
     */
    private final ConcurrentHashMap<String, CacheEntry> blocklistCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = TimeUnit.MINUTES.toMillis(5);

    private static class CacheEntry {
        final boolean isBlocked;
        final long timestamp;

        CacheEntry(boolean isBlocked) {
            this.isBlocked = isBlocked;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }

    /**
     * Check if an email address is blocked from receiving emails.
     * Uses in-memory cache for performance.
     */
    public boolean isEmailBlocked(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }

        String normalizedEmail = email.toLowerCase().trim();

        // Check cache first
        CacheEntry cached = blocklistCache.get(normalizedEmail);
        if (cached != null && !cached.isExpired()) {
            return cached.isBlocked;
        }

        // Query database
        boolean isBlocked = bouncedEmailRepository.isEmailBlocked(normalizedEmail);

        // Update cache
        blocklistCache.put(normalizedEmail, new CacheEntry(isBlocked));

        return isBlocked;
    }

    /**
     * Add an email to the blocklist due to a bounce event.
     * If the email already exists, updates the record with new bounce information.
     */
    @Transactional
    public BouncedEmail addBouncedEmail(String email, String bounceType, String bounceSubType,
                                         String bounceReason, String sesMessageId, String originalNotificationLogId) {
        if (email == null || email.trim().isEmpty()) {
            log.warn("Attempted to add null or empty email to blocklist");
            return null;
        }

        String normalizedEmail = email.toLowerCase().trim();

        // Check if already exists
        Optional<BouncedEmail> existing = bouncedEmailRepository.findByEmailIgnoreCase(normalizedEmail);
        
        if (existing.isPresent()) {
            BouncedEmail existingRecord = existing.get();
            // Update with new bounce info and reactivate if it was unblocked
            existingRecord.setBounceType(bounceType);
            existingRecord.setBounceSubType(bounceSubType);
            existingRecord.setBounceReason(bounceReason);
            existingRecord.setSesMessageId(sesMessageId);
            existingRecord.setOriginalNotificationLogId(originalNotificationLogId);
            existingRecord.setIsActive(true);
            
            BouncedEmail saved = bouncedEmailRepository.save(existingRecord);
            log.info("Updated existing bounced email record for: {} (bounce type: {}/{})", 
                normalizedEmail, bounceType, bounceSubType);
            
            // Invalidate cache
            blocklistCache.put(normalizedEmail, new CacheEntry(true));
            
            return saved;
        }

        // Create new record
        BouncedEmail newBounce = new BouncedEmail(
            normalizedEmail, bounceType, bounceSubType, 
            bounceReason, sesMessageId, originalNotificationLogId
        );

        BouncedEmail saved = bouncedEmailRepository.save(newBounce);
        log.info("Added new email to blocklist: {} (bounce type: {}/{})", 
            normalizedEmail, bounceType, bounceSubType);

        // Update cache
        blocklistCache.put(normalizedEmail, new CacheEntry(true));

        return saved;
    }

    /**
     * Unblock an email address (admin operation).
     * Sets is_active to false instead of deleting to maintain history.
     */
    @Transactional
    public boolean unblockEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }

        String normalizedEmail = email.toLowerCase().trim();
        int updated = bouncedEmailRepository.unblockEmail(normalizedEmail);
        
        if (updated > 0) {
            log.info("Unblocked email: {}", normalizedEmail);
            blocklistCache.put(normalizedEmail, new CacheEntry(false));
            return true;
        }
        
        log.warn("No bounced email record found to unblock: {}", normalizedEmail);
        return false;
    }

    /**
     * Re-block a previously unblocked email (admin operation).
     */
    @Transactional
    public boolean reblockEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }

        String normalizedEmail = email.toLowerCase().trim();
        int updated = bouncedEmailRepository.reblockEmail(normalizedEmail);
        
        if (updated > 0) {
            log.info("Re-blocked email: {}", normalizedEmail);
            blocklistCache.put(normalizedEmail, new CacheEntry(true));
            return true;
        }
        
        log.warn("No bounced email record found to re-block: {}", normalizedEmail);
        return false;
    }

    /**
     * Get all blocked emails with pagination.
     */
    public Page<BouncedEmail> getBlockedEmails(Pageable pageable) {
        return bouncedEmailRepository.findByIsActiveTrue(pageable);
    }

    /**
     * Get all bounced email records with pagination (including unblocked).
     */
    public Page<BouncedEmail> getAllBouncedEmails(Pageable pageable) {
        return bouncedEmailRepository.findAll(pageable);
    }

    /**
     * Search blocked emails by email pattern.
     */
    public Page<BouncedEmail> searchBlockedEmails(String searchTerm, Pageable pageable) {
        return bouncedEmailRepository.searchByEmail(searchTerm, pageable);
    }

    /**
     * Get bounced email details by email address.
     */
    public Optional<BouncedEmail> getBouncedEmailDetails(String email) {
        if (email == null || email.trim().isEmpty()) {
            return Optional.empty();
        }
        return bouncedEmailRepository.findByEmailIgnoreCase(email.toLowerCase().trim());
    }

    /**
     * Get statistics about blocked emails.
     */
    public BlocklistStats getBlocklistStats() {
        long totalBlocked = bouncedEmailRepository.countByIsActiveTrue();
        long permanentBounces = bouncedEmailRepository.countByBounceTypeAndIsActiveTrue("Permanent");
        long transientBounces = bouncedEmailRepository.countByBounceTypeAndIsActiveTrue("Transient");
        
        return new BlocklistStats(totalBlocked, permanentBounces, transientBounces);
    }

    /**
     * Clear the in-memory cache (useful for testing or manual refresh).
     */
    public void clearCache() {
        blocklistCache.clear();
        log.info("Bounced email blocklist cache cleared");
    }

    /**
     * Check multiple emails for blocking (batch operation).
     * Returns list of emails that ARE blocked.
     */
    public List<String> filterBlockedEmails(List<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }

        List<String> normalizedEmails = emails.stream()
            .filter(e -> e != null && !e.trim().isEmpty())
            .map(e -> e.toLowerCase().trim())
            .toList();

        return bouncedEmailRepository.findBlockedEmails(normalizedEmails);
    }

    /**
     * Statistics record for blocklist.
     */
    public record BlocklistStats(
        long totalBlocked,
        long permanentBounces,
        long transientBounces
    ) {}
}

