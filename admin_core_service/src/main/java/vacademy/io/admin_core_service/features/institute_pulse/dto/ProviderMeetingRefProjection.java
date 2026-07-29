package vacademy.io.admin_core_service.features.institute_pulse.dto;

/** Maps a provider meeting id back to the schedule/session/institute it belongs to. */
public interface ProviderMeetingRefProjection {

    String getProviderMeetingId();

    String getScheduleId();

    String getSessionId();

    String getInstituteId();

    String getTitle();
}
