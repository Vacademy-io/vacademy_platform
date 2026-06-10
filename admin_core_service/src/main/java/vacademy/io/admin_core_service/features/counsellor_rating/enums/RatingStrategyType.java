package vacademy.io.admin_core_service.features.counsellor_rating.enums;

public enum RatingStrategyType {
    /** Per-counsellor manual override. counsellor_rating.manual_override is the score. */
    STATIC,
    /** Computed from conversion ratio + time-to-convert; see CounsellorRatingComputeService. */
    STRATEGY_BASED
}
