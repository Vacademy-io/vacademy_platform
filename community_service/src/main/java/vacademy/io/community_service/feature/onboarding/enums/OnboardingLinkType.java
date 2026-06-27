package vacademy.io.community_service.feature.onboarding.enums;

/** The three flavours of shareable onboarding link. */
public enum OnboardingLinkType {
    /** Asks every question; prospect picks the institute type at the end. */
    GENERAL,
    /** Super-admin chose which questions to show and prefilled known answers. */
    CUSTOM,
    /** No questions — straight to the demo handoff (institute type may be forced). */
    DIRECT_DEMO
}
