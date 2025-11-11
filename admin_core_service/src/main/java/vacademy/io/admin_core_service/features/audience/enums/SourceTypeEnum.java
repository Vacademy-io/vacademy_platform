package vacademy.io.admin_core_service.features.audience.enums;

/**
 * Enum for Lead Source Type
 * Identifies where the lead came from
 */
public enum SourceTypeEnum {
    WEBSITE,        // Website form submission
    GOOGLE_ADS,     // Google Ads webhook (future)
    FACEBOOK_ADS,   // Facebook Ads webhook (future)
    LINKEDIN_ADS,   // LinkedIn Ads webhook (future)
    INSTAGRAM_ADS,  // Instagram Ads webhook (future)
    TWITTER_ADS,    // Twitter Ads webhook (future)
    MANUAL          // Manually added lead
}

