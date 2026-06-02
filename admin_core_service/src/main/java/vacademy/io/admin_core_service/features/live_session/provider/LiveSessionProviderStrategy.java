package vacademy.io.admin_core_service.features.live_session.provider;

import vacademy.io.common.meeting.dto.CreateMeetingRequestDTO;
import vacademy.io.common.meeting.dto.CreateMeetingResponseDTO;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;
import vacademy.io.common.meeting.dto.ParticipantJoinLinkDTO;
import vacademy.io.common.meeting.dto.UserScheduleAvailabilityDTO;

import java.util.List;

/**
 * Strategy interface for live session providers (Zoho Meeting, Google Meet,
 * Zoom, etc.)
 * Add a new provider by:
 * 1. Implementing this interface
 * 2. Registering the bean in LiveSessionProviderFactory
 */
public interface LiveSessionProviderStrategy {

    /**
     * Create a meeting on the provider platform.
     */
    CreateMeetingResponseDTO createMeeting(CreateMeetingRequestDTO request, String instituteId);

    /**
     * Register a participant with the provider and return a unique join link
     * pre-filled with their name/email so they skip the guest form.
     *
     * Default: not supported. Join-URL providers (BBB, Zoho) override it; SDK-join
     * providers (e.g. Zoom) leave it as the default and issue a signature instead
     * (see {@link #supportsSdkJoin()}), so a new provider need not implement it.
     */
    default ParticipantJoinLinkDTO getParticipantJoinLink(String providerMeetingId, String participantName,
            String participantEmail, String instituteId) {
        throw new vacademy.io.common.exceptions.VacademyException(
                org.springframework.http.HttpStatus.NOT_IMPLEMENTED,
                "getParticipantJoinLink not supported by provider " + getProviderName()
                        + " — SDK-join providers issue a per-join signature instead");
    }

    /** Whether this provider joins via an embedded SDK signature (vs a pre-registered join URL). */
    default boolean supportsSdkJoin() {
        return false;
    }

    /** Whether this provider supports multiple per-institute accounts (vs a single connected config). */
    default boolean supportsMultiAccount() {
        return false;
    }

    /** Whether this provider delivers attendance/recording events via webhooks. */
    default boolean supportsWebhooks() {
        return false;
    }

    /**
     * Fetch all recordings for a given provider meeting ID.
     */
    List<MeetingRecordingDTO> getRecordings(String providerMeetingId, String instituteId);

    /**
     * Fetch attendee report for a given provider meeting ID.
     */
    List<MeetingAttendeeDTO> getAttendance(String providerMeetingId, String instituteId);

    /**
     * Check whether the organizer (vendorUserId) has any conflicting sessions in
     * the requested time window. Pass null for vendorUserId to use the
     * institute-wide credential.
     */
    UserScheduleAvailabilityDTO checkUserAvailability(
            String requestedStartTimeIso, int durationMinutes, String instituteId, String vendorUserId);

    /**
     * Connect and authenticate an institute with the provider (OAuth, API keys).
     */
    vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig connectProvider(
            vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO request);

    /**
     * Connect and authenticate an institute with the provider's SDK (if supported).
     * Only providers that support an embedded/SDK flow need to override this.
     */
    default vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig connectSdkProvider(
            vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO request) {
        throw new vacademy.io.common.exceptions.VacademyException(
                "SDK connect not supported for provider: " + getProviderName());
    }

    /**
     * Returns the provider name (for logging/validation).
     */
    String getProviderName();
}
