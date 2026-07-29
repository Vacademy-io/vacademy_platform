package vacademy.io.admin_core_service.features.institute_pulse.dto;

/** One event on the institute-wide live feed. */
public interface InstituteFeedEventProjection {

    Long getOccurredAtEpoch();

    String getUserId();

    String getFullName();

    String getSlideId();

    String getSlideTitle();

    String getSlideType();

    /** CONTENT or LIVE_CLASS — which rail this event came from. */
    String getRail();

    String getEventType();

    String getDetail();

    /** HOST when the actor was hosting the class, else null. */
    String getActorRole();
}
