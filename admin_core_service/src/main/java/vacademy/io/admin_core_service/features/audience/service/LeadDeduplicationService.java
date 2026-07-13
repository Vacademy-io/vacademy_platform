package vacademy.io.admin_core_service.features.audience.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.timeline.enums.LeadJourneyActionType;
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

    @Autowired
    private LeadDedupSettingService leadDedupSettingService;

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

        // Log a JOURNEY event on the primary response — duplicate merges are lifecycle milestones
        timelineEventService.logJourneyEvent(
                "AUDIENCE_RESPONSE",
                primaryResponse.getId(),
                LeadJourneyActionType.DUPLICATE_MERGED,
                "SYSTEM",
                null,
                "System",
                "Duplicate lead merged",
                "New submission from " + (sourceType != null ? sourceType : "UNKNOWN")
                        + " merged into this lead",
                Map.of(
                        "duplicate_response_id", duplicateResponse.getId() != null ? duplicateResponse.getId() : "",
                        "source_type", sourceType != null ? sourceType : "UNKNOWN"
                ),
                primaryResponse.getStudentUserId()
        );

        logger.info("Marked response as duplicate of primary={}, source={}",
                primaryResponse.getId(), sourceType);
    }

    /**
     * Institute-configurable hard-reject dedup check (LEAD_SETTING.data.dedup).
     * Independent of {@link #generateDedupeKey} / {@link #findDuplicate} / {@link #markDuplicate},
     * which remain the enquiry flow's soft-merge mechanism used when this setting is disabled.
     *
     * @return a user-facing rejection message if a matching, non-duplicate, non-opted-out
     *         lead already exists per the institute's configured field+scope; empty if the
     *         setting is disabled, the relevant field is blank, or no match was found.
     */
    public Optional<String> checkForRejection(String instituteId, String audienceId, String email, String phone) {
        LeadDedupSettingService.DedupSettings settings = leadDedupSettingService.get(instituteId);
        if (!settings.enabled()) return Optional.empty();

        LeadDedupSettingService.DedupScope scope = settings.scope();
        // A SELECTED scope with no lists configured has nothing to check against —
        // fail open (no rejection) rather than silently blocking every submission.
        if (scope == LeadDedupSettingService.DedupScope.SELECTED
                && (settings.audienceIds() == null || settings.audienceIds().isEmpty())) {
            return Optional.empty();
        }

        String scopeLabel = switch (scope) {
            case INSTITUTE -> "in this institute";
            case SELECTED -> "in one of the selected lead lists";
            case CAMPAIGN -> "in this lead list";
        };

        if (settings.field() == LeadDedupSettingService.DedupField.PHONE) {
            String last10 = lastNDigits(phone, 10);
            if (last10 == null) return Optional.empty();
            boolean exists = switch (scope) {
                case INSTITUTE -> audienceResponseRepository.existsByInstituteIdAndPhoneLast10(instituteId, last10);
                case SELECTED -> audienceResponseRepository.existsByAudienceIdInAndPhoneLast10(
                        settings.audienceIds(), last10);
                case CAMPAIGN -> audienceResponseRepository.existsByAudienceIdAndPhoneLast10(audienceId, last10);
            };
            return exists
                    ? Optional.of("A lead with this phone number already exists " + scopeLabel + ".")
                    : Optional.empty();
        }

        String normalizedEmail = (email != null) ? email.trim() : "";
        if (normalizedEmail.isEmpty()) return Optional.empty();
        boolean exists = switch (scope) {
            case INSTITUTE -> audienceResponseRepository
                    .existsByInstituteIdAndParentEmailIgnoreCase(instituteId, normalizedEmail);
            case SELECTED -> audienceResponseRepository
                    .existsByAudienceIdInAndParentEmailIgnoreCase(settings.audienceIds(), normalizedEmail);
            case CAMPAIGN -> audienceResponseRepository
                    .existsByAudienceIdAndParentEmailIgnoreCase(audienceId, normalizedEmail);
        };
        return exists
                ? Optional.of("A lead with this email already exists " + scopeLabel + ".")
                : Optional.empty();
    }

    /**
     * Strip non-digits and return the last n digits (tolerates country-code prefixes),
     * or null if there aren't enough digits to compare.
     */
    private String lastNDigits(String phone, int n) {
        if (phone == null) return null;
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() < n) return null;
        return digits.substring(digits.length() - n);
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
