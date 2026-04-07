package vacademy.io.admin_core_service.features.audience.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadScore;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadScoreRepository;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.timeline.repository.TimelineEventRepository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Real-time lead scoring engine.
 * Calculates raw_score (0-100) immediately on every lead event.
 * Percentile ranks are recalculated in batch every 15 minutes.
 *
 * Scoring factors:
 * 1. SOURCE_QUALITY (25%): Source type credibility
 * 2. PROFILE_COMPLETENESS (30%): How many key fields are filled
 * 3. RECENCY (25%): Time decay — newer leads score higher
 * 4. ENGAGEMENT (20%): Timeline events count
 */
@Service
public class LeadScoringService {

    private static final Logger logger = LoggerFactory.getLogger(LeadScoringService.class);

    // Default weights (can be overridden per institute via settingJson)
    private static final int DEFAULT_SOURCE_WEIGHT = 25;
    private static final int DEFAULT_COMPLETENESS_WEIGHT = 30;
    private static final int DEFAULT_RECENCY_WEIGHT = 25;
    private static final int DEFAULT_ENGAGEMENT_WEIGHT = 20;
    private static final int DEFAULT_DECAY_DAYS = 30;

    // Default source quality scores
    private static final Map<String, Integer> DEFAULT_SOURCE_SCORES = Map.of(
            "GOOGLE_ADS", 90,
            "FACEBOOK_ADS", 80,
            "LINKEDIN_ADS", 85,
            "INSTAGRAM_ADS", 75,
            "TWITTER_ADS", 70,
            "WEBSITE", 70,
            "WALK_IN", 85,
            "MANUAL", 40
    );

    @Autowired
    private LeadScoreRepository leadScoreRepository;

    @Autowired
    private AudienceResponseRepository audienceResponseRepository;

    @Autowired
    private EnquiryRepository enquiryRepository;

    @Autowired
    private CustomFieldValuesRepository customFieldValuesRepository;

    @Autowired
    private TimelineEventRepository timelineEventRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserLeadProfileService userLeadProfileService;

    /**
     * Calculate and persist lead score for an AudienceResponse.
     * Called in real-time on lead creation and lead events.
     *
     * @param audienceResponseId The audience response ID
     * @param audienceId         The audience/campaign ID
     * @param instituteId        The institute ID
     * @param sourceType         The lead source type
     * @param enquiryId          The linked enquiry ID (may be null)
     */
    @Transactional
    public LeadScore calculateAndSaveScore(String audienceResponseId, String audienceId,
                                            String instituteId, String sourceType,
                                            String enquiryId) {
        logger.debug("Calculating lead score for response: {}", audienceResponseId);

        // Factor 1: Source Quality (0-100)
        int sourceScore = calculateSourceScore(sourceType);

        // Factor 2: Profile Completeness (0-100)
        int completenessScore = calculateCompletenessScore(audienceResponseId, enquiryId);

        // Factor 3: Recency (0-100)
        int recencyScore = calculateRecencyScore(audienceResponseId);

        // Factor 4: Engagement (0-100)
        int engagementScore = calculateEngagementScore(enquiryId, audienceResponseId);

        // Weighted sum
        int rawScore = (sourceScore * DEFAULT_SOURCE_WEIGHT
                + completenessScore * DEFAULT_COMPLETENESS_WEIGHT
                + recencyScore * DEFAULT_RECENCY_WEIGHT
                + engagementScore * DEFAULT_ENGAGEMENT_WEIGHT) / 100;

        // Clamp to 0-100
        rawScore = Math.max(0, Math.min(100, rawScore));

        // Build scoring factors breakdown for UI
        Map<String, Object> factors = new LinkedHashMap<>();
        factors.put("source_quality", Map.of("score", sourceScore, "weight", DEFAULT_SOURCE_WEIGHT,
                "contribution", sourceScore * DEFAULT_SOURCE_WEIGHT / 100));
        factors.put("profile_completeness", Map.of("score", completenessScore, "weight", DEFAULT_COMPLETENESS_WEIGHT,
                "contribution", completenessScore * DEFAULT_COMPLETENESS_WEIGHT / 100));
        factors.put("recency", Map.of("score", recencyScore, "weight", DEFAULT_RECENCY_WEIGHT,
                "contribution", recencyScore * DEFAULT_RECENCY_WEIGHT / 100));
        factors.put("engagement", Map.of("score", engagementScore, "weight", DEFAULT_ENGAGEMENT_WEIGHT,
                "contribution", engagementScore * DEFAULT_ENGAGEMENT_WEIGHT / 100));

        String factorsJson;
        try {
            factorsJson = objectMapper.writeValueAsString(factors);
        } catch (JsonProcessingException e) {
            factorsJson = null;
            logger.error("Failed to serialize scoring factors", e);
        }

        // Upsert the score
        LeadScore leadScore = leadScoreRepository.findByAudienceResponseId(audienceResponseId)
                .orElse(LeadScore.builder()
                        .audienceResponseId(audienceResponseId)
                        .audienceId(audienceId)
                        .instituteId(instituteId)
                        .build());

        leadScore.setRawScore(rawScore);
        leadScore.setScoringFactorsJson(factorsJson);
        leadScore.setLastCalculatedAt(new Timestamp(System.currentTimeMillis()));

        LeadScore saved = leadScoreRepository.save(leadScore);
        logger.info("Lead score calculated: response={}, score={}, tier={}",
                audienceResponseId, rawScore, saved.getTier());

        // Asynchronously update the user-level lead profile
        try {
            AudienceResponse response = audienceResponseRepository.findById(audienceResponseId).orElse(null);
            if (response != null) {
                String profileUserId = response.getUserId() != null
                        ? response.getUserId()
                        : response.getStudentUserId();
                if (profileUserId != null) {
                    userLeadProfileService.buildOrUpdateProfile(profileUserId, instituteId);
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to update user_lead_profile after score save for response={}", audienceResponseId, e);
        }

        return saved;
    }

    /**
     * Recalculate score for a lead (triggered by events like status change, note added, etc.)
     */
    @Transactional
    public void recalculateScore(String audienceResponseId) {
        AudienceResponse response = audienceResponseRepository.findById(audienceResponseId).orElse(null);
        if (response == null) {
            logger.warn("Cannot recalculate score — AudienceResponse not found: {}", audienceResponseId);
            return;
        }

        // Find the institute via Audience
        String instituteId = null;
        try {
            // Use the existing score's institute
            LeadScore existing = leadScoreRepository.findByAudienceResponseId(audienceResponseId).orElse(null);
            if (existing != null) {
                instituteId = existing.getInstituteId();
            }
        } catch (Exception e) {
            logger.error("Error getting institute for recalculation", e);
        }

        if (instituteId == null) {
            logger.warn("Cannot determine institute for response: {}", audienceResponseId);
            return;
        }

        calculateAndSaveScore(
                audienceResponseId,
                response.getAudienceId(),
                instituteId,
                response.getSourceType(),
                response.getEnquiryId()
        );
    }

    /**
     * Batch recalculate percentile ranks every 15 minutes.
     * Percentile is an expensive operation (touches all rows) so it runs as batch.
     */
    @Scheduled(fixedRate = 15 * 60 * 1000) // 15 minutes
    @Transactional
    public void batchRecalculatePercentiles() {
        logger.info("Starting batch percentile recalculation...");
        List<String> audienceIds = leadScoreRepository.findDistinctAudienceIds();

        int total = 0;
        for (String audienceId : audienceIds) {
            try {
                leadScoreRepository.recalculatePercentilesForAudience(audienceId);
                total++;
            } catch (Exception e) {
                logger.error("Failed to recalculate percentiles for audience: {}", audienceId, e);
            }
        }

        logger.info("Batch percentile recalculation complete. Processed {} audiences.", total);
    }

    // ─────────────────────────────────────────────────────────
    // Factor Calculation Methods
    // ─────────────────────────────────────────────────────────

    /**
     * Factor 1: Source Quality (0-100)
     * Higher-intent sources score higher.
     */
    private int calculateSourceScore(String sourceType) {
        if (sourceType == null) return 40; // default for unknown
        return DEFAULT_SOURCE_SCORES.getOrDefault(sourceType.toUpperCase(), 50);
    }

    /**
     * Factor 2: Profile Completeness (0-100)
     * Percentage of key fields filled across AudienceResponse + custom fields.
     */
    private int calculateCompletenessScore(String audienceResponseId, String enquiryId) {
        int totalFields = 0;
        int filledFields = 0;

        // Check AudienceResponse fields
        AudienceResponse response = audienceResponseRepository.findById(audienceResponseId).orElse(null);
        if (response != null) {
            totalFields += 4; // parentName, parentEmail, parentMobile, studentUserId
            if (StringUtils.hasText(response.getParentName())) filledFields++;
            if (StringUtils.hasText(response.getParentEmail())) filledFields++;
            if (StringUtils.hasText(response.getParentMobile())) filledFields++;
            if (StringUtils.hasText(response.getStudentUserId())) filledFields++;
        }

        // Check custom field values count
        long customFieldCount = customFieldValuesRepository
                .findBySourceTypeAndSourceId("AUDIENCE_RESPONSE", audienceResponseId)
                .size();
        // Assume a good submission has 3+ custom fields
        totalFields += 3;
        filledFields += Math.min(3, (int) customFieldCount);

        // Check Enquiry fields if available
        if (StringUtils.hasText(enquiryId)) {
            try {
                Enquiry enquiry = enquiryRepository.findById(UUID.fromString(enquiryId)).orElse(null);
                if (enquiry != null) {
                    totalFields += 3; // referenceSource, mode, parentRelationWithChild
                    if (StringUtils.hasText(enquiry.getReferenceSource())) filledFields++;
                    if (StringUtils.hasText(enquiry.getMode())) filledFields++;
                    if (StringUtils.hasText(enquiry.getParentRelationWithChild())) filledFields++;
                }
            } catch (Exception e) {
                // Ignore — enquiry might have non-UUID id format
            }
        }

        if (totalFields == 0) return 50; // default
        return (filledFields * 100) / totalFields;
    }

    /**
     * Factor 3: Recency (0-100)
     * Linear decay over DEFAULT_DECAY_DAYS days. Brand new = 100, 30+ days old = 0.
     */
    private int calculateRecencyScore(String audienceResponseId) {
        AudienceResponse response = audienceResponseRepository.findById(audienceResponseId).orElse(null);
        if (response == null || response.getSubmittedAt() == null) return 50;

        long daysSinceSubmission = ChronoUnit.DAYS.between(
                response.getSubmittedAt().toInstant(),
                Instant.now());

        if (daysSinceSubmission <= 0) return 100;
        if (daysSinceSubmission >= DEFAULT_DECAY_DAYS) return 0;

        return (int) ((DEFAULT_DECAY_DAYS - daysSinceSubmission) * 100L / DEFAULT_DECAY_DAYS);
    }

    /**
     * Factor 4: Engagement (0-100)
     * Based on number of timeline events (notes, status changes, etc.)
     * 0 events = 0, 1 event = 30, 2 events = 50, 3 events = 70, 5+ events = 100
     */
    private int calculateEngagementScore(String enquiryId, String audienceResponseId) {
        long eventCount = 0;

        // Count timeline events for the enquiry
        if (StringUtils.hasText(enquiryId)) {
            eventCount = timelineEventRepository.countByTypeAndTypeId("ENQUIRY", enquiryId);
        }

        // Also count timeline events for the audience response
        eventCount += timelineEventRepository.countByTypeAndTypeId("AUDIENCE_RESPONSE", audienceResponseId);

        if (eventCount == 0) return 0;
        if (eventCount == 1) return 30;
        if (eventCount == 2) return 50;
        if (eventCount <= 4) return 70;
        return 100; // 5+ events
    }
}
