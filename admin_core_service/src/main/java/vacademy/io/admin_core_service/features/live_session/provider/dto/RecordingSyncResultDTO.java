package vacademy.io.admin_core_service.features.live_session.provider.dto;

import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.util.List;

/**
 * Response DTO for the POST /meeting/recordings/sync endpoint.
 *
 * status values:
 *   OK          — all BBB recordings found were synced (or already up to date)
 *   BBB_OFFLINE — BBB server was unreachable; returned current DB state unchanged
 *   PARTIAL     — some recordings synced, others failed (download/upload errors)
 *   RECOVERING  — BBB API returned no recordings, but raw files exist on the BBB
 *                 server with a stalled pipeline. The heal service has been asked
 *                 to restart the rap-worker pipeline. Recording will appear after
 *                 BBB finishes processing (~10 minutes).
 *   NOT_FOUND   — BBB has no recording for this meeting and no raw files exist on
 *                 the server — nothing to recover.
 */
public record RecordingSyncResultDTO(
        List<MeetingRecordingDTO> recordings,
        String status,
        String message
) {
    public static RecordingSyncResultDTO ok(List<MeetingRecordingDTO> recordings, int newCount) {
        String msg = newCount == 0
                ? "Already up to date."
                : "Sync complete — found " + newCount + " new recording(s).";
        return new RecordingSyncResultDTO(recordings, "OK", msg);
    }

    public static RecordingSyncResultDTO bbbOffline(List<MeetingRecordingDTO> recordings) {
        return new RecordingSyncResultDTO(recordings, "BBB_OFFLINE",
                "BBB server is currently offline. Recordings will appear once the server is back online.");
    }

    public static RecordingSyncResultDTO partial(List<MeetingRecordingDTO> recordings, int newCount, int failCount) {
        return new RecordingSyncResultDTO(recordings, "PARTIAL",
                "Partially synced — " + newCount + " recording(s) synced, " + failCount + " could not be retrieved.");
    }

    public static RecordingSyncResultDTO recovering(List<MeetingRecordingDTO> recordings, String previousState) {
        return new RecordingSyncResultDTO(recordings, "RECOVERING",
                "Recording was stalled at '" + previousState + "' stage on the BBB server. "
                        + "Pipeline restarted — recording will be available in about 10 minutes.");
    }

    public static RecordingSyncResultDTO notFound(List<MeetingRecordingDTO> recordings) {
        return new RecordingSyncResultDTO(recordings, "NOT_FOUND",
                "No recording was captured for this session on the BBB server.");
    }

    public static RecordingSyncResultDTO reprocessing(List<MeetingRecordingDTO> recordings) {
        return new RecordingSyncResultDTO(recordings, "REPROCESSING",
                "Recording exists on the BBB server but hasn't been uploaded yet. "
                        + "Re-running the upload — check back in a few minutes.");
    }
}
