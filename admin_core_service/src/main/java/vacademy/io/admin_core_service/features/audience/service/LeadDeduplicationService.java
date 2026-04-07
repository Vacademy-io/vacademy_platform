package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Optional;

/**
 * Lead deduplication service scoped within a single Audience/Campaign.
 * Generates a dedupe_key from normalized email + phone and checks for existing leads.
 */
@Service
public class LeadDeduplicationService {

    private static final Logger logger = LoggerFactory.getLogger(LeadDeduplicationService.class);

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private TimelineEventService timelineEventService;

    /**
     * Generate a dedupe key from email and phone.
     * Normalizes: lowercase email, strip non-digit chars from phone.
     * Returns SHA-256 hash truncated to 32 chars.
     */
    public String generateDedupeKey(String email, String phone) {
        String normalizedEmail = (email != null) ? email.toLowerCase().trim() : "";
        String normalizedPhone = (phone != null) ? phone.replaceAll("[^0-9]", "") : "";

        // If both are empty, return null (can't dedupe without identifier)
        if (normalizedEmail.isEmpty() && normalizedPhone.isEmpty()) {
            return null;
        }

        String combined = normalizedEmail + "|" + normalizedPhone;
        return sha256(combined).substring(0, 32);
    }

    /**
     * Check if a lead is a duplicate within the same campaign.
     *
     * @param audienceId   The campaign ID to scope the dedupe check
     * @param dedupeKey    The generated dedupe key
     * @return The existing primary AudienceResponse if duplicate, empty if new lead
     */
    public Optional<AudienceResponse> findDuplicate(String audienceId, String dedupeKey) {
        if (dedupeKey == null) return Optional.empty();
        return audienceResponseRepository.findByAudienceIdAndDedupeKey(audienceId, dedupeKey);
    }

    /**
     * Mark a new response as a duplicate and merge source info on the primary.
     *
     * @param duplicateResponse  The new (duplicate) response
     * @param primaryResponse    The existing (primary) response
     * @param sourceType         Source type of the new submission
     */
    public void markDuplicate(AudienceResponse duplicateResponse,
                               AudienceResponse primaryResponse,
                               String sourceType) {
        // Mark the new response as duplicate
        duplicateResponse.setIsDuplicate(true);
        duplicateResponse.setPrimaryResponseId(primaryResponse.getId());

        // Log a timeline event on the primary response
        timelineEventService.logEvent(
                "AUDIENCE_RESPONSE",
                primaryResponse.getId(),
                "DUPLICATE_MERGED",
                "SYSTEM",
                null,
                "System",
                "Duplicate lead merged",
                "New submission from " + (sourceType != null ? sourceType : "UNKNOWN")
                        + " merged into this lead",
                Map.of(
                        "duplicate_response_id", duplicateResponse.getId() != null ? duplicateResponse.getId() : "",
                        "source_type", sourceType != null ? sourceType : "UNKNOWN"
                )
        );

        logger.info("Marked response as duplicate of primary={}, source={}",
                primaryResponse.getId(), sourceType);
    }

    /**
     * SHA-256 hash helper.
     */
    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
