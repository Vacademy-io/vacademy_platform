package vacademy.io.admin_core_service.features.institute_pulse.dto;

/**
 * One currently-present learner anywhere in the institute, with their latest slide and the
 * struggle signals for it. Unquoted camelCase aliases in the native query are lower-cased by
 * Postgres and matched case-insensitively to these getters.
 */
public interface InstituteRosterRowProjection {

    String getUserId();

    String getFullName();

    String getSlideId();

    String getSlideTitle();

    String getSlideType();

    Long getOnSlideSeconds();

    Long getLastSeenAgoSeconds();

    /** Wrong question + quiz answers on the current slide, this visit. */
    Long getWrongCount();

    /** Failing code submissions inside the presence window. */
    Long getFailedCodeCount();

    /** ACTIVE, IDLE or NEEDS_HELP — derived in SQL so the page can be ordered and limited there. */
    String getState();

    // The four counts below are window aggregates over the WHOLE active set, so they are
    // identical on every row of every page and stay correct no matter which page is fetched.

    Long getTotalPresent();

    Long getActiveCount();

    Long getIdleCount();

    Long getNeedHelpCount();
}
