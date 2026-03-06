package vacademy.io.admin_core_service.features.live_session.provider;

import vacademy.io.common.meeting.dto.CreateMeetingRequestDTO;
import vacademy.io.common.meeting.dto.CreateMeetingResponseDTO;
import vacademy.io.common.meeting.dto.MeetingAttendeeDTO;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

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
     * The providerConfig map contains the stored credentials (clientId, tokens,
     * etc.)
     * for the institute, fetched from live_session_provider_config table.
     */
    CreateMeetingResponseDTO createMeeting(CreateMeetingRequestDTO request, String instituteId);

    /**
     * Fetch all recordings for a given provider meeting ID.
     */
    List<MeetingRecordingDTO> getRecordings(String providerMeetingId, String instituteId);

    /**
     * Fetch attendee report for a given provider meeting ID.
     * Returns one entry per attendee with join/leave times.
     */
    List<MeetingAttendeeDTO> getAttendance(String providerMeetingId, String instituteId);

    /**
     * Connect and authenticate an institute with the provider (OAuth, API keys).
     */
    vacademy.io.admin_core_service.features.live_session.provider.entity.LiveSessionProviderConfig connectProvider(
            vacademy.io.admin_core_service.features.live_session.provider.dto.ProviderConnectRequestDTO request);

    /**
     * Returns the provider name (for logging/validation).
     */
    String getProviderName();
}
