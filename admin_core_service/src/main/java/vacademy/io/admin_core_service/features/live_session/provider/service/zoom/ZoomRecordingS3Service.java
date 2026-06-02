package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.live_session.provider.support.ByteArrayMultipartFile;
import vacademy.io.common.media.service.FileService;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Mirrors Zoom cloud recordings to Vacademy S3 (via the media service) so they
 * survive Zoom's ~30-day auto-delete. For each not-yet-mirrored recording it
 * downloads the bytes (authenticated with the account's S2S access token) and
 * uploads them through {@link FileService#uploadDataToS3}, then flips the
 * recording to {@code S3}: sets {@code fileId}, {@code recordingStorage=S3} and
 * clears {@code expiresAt} (no longer provider-expiring).
 *
 * Idempotent — recordings that already have a {@code fileId} are skipped, so it's
 * safe to re-run (manual button + scheduled near-expiry rescue share this path).
 * Graceful — a per-recording failure leaves that recording untouched on Zoom Cloud
 * and the others proceed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZoomRecordingS3Service {

    private final ZoomAccountStore zoomAccountStore;
    private final ZoomAccessTokenService accessTokenService;
    private final ZoomRecordingService zoomRecordingService;
    private final FileService fileService;

    /**
     * @param onlyNearExpiry when true, only mirror recordings expiring within
     *                       {@code withinDays} (scheduled rescue); when false, mirror
     *                       every un-mirrored recording (manual "Sync to S3").
     * @return number of recordings newly mirrored to S3
     */
    public int mirrorToS3(SessionSchedule schedule, boolean onlyNearExpiry, int withinDays) {
        if (schedule.getProviderAccountId() == null || schedule.getProviderAccountId().isBlank()) {
            return 0;
        }
        ZoomAccount account = zoomAccountStore.findById(schedule.getProviderAccountId()).orElse(null);
        if (account == null) {
            return 0;
        }
        List<MeetingRecordingDTO> recordings = zoomRecordingService.getStoredRecordings(schedule);
        if (recordings.isEmpty()) {
            return 0;
        }

        String token = null;
        int mirrored = 0;
        long nearExpiryCutoff = Instant.now().plus(withinDays, ChronoUnit.DAYS).toEpochMilli();

        for (MeetingRecordingDTO rec : recordings) {
            if (rec.getFileId() != null && !rec.getFileId().isBlank()) {
                continue; // already on S3
            }
            if (rec.getDownloadUrl() == null || rec.getDownloadUrl().isBlank()) {
                continue; // nothing to download
            }
            if (onlyNearExpiry && !isExpiringWithin(rec, nearExpiryCutoff)) {
                continue; // not urgent yet
            }
            try {
                if (token == null) {
                    token = accessTokenService.getAccessToken(account);
                }
                byte[] bytes = downloadBytes(rec.getDownloadUrl(), token);
                if (bytes == null || bytes.length == 0) {
                    log.warn("zoom.s3.mirror empty download recordingId={} scheduleId={}",
                            rec.getRecordingId(), schedule.getId());
                    continue;
                }
                String filename = buildFilename(schedule, rec);
                String fileId = fileService.uploadDataToS3(
                        new ByteArrayMultipartFile(bytes, filename, "video/mp4"));
                if (fileId == null || fileId.isBlank()) {
                    log.warn("zoom.s3.mirror upload returned no fileId recordingId={}", rec.getRecordingId());
                    continue;
                }
                rec.setFileId(fileId);
                rec.setRecordingStorage("S3");
                rec.setExpiresAt(null); // on our storage now — no provider auto-delete
                mirrored++;
                log.info("zoom.s3.mirror ok scheduleId={} recordingId={} fileId={} bytes={}",
                        schedule.getId(), rec.getRecordingId(), fileId, bytes.length);
            } catch (Exception e) {
                // Leave this recording on Zoom Cloud; others continue.
                log.error("zoom.s3.mirror failed scheduleId={} recordingId={}: {}",
                        schedule.getId(), rec.getRecordingId(), e.getMessage());
            }
        }

        if (mirrored > 0) {
            zoomRecordingService.replaceRecordings(schedule, recordings);
        }
        return mirrored;
    }

    private static boolean isExpiringWithin(MeetingRecordingDTO rec, long cutoffEpochMillis) {
        if (rec.getExpiresAt() == null || rec.getExpiresAt().isBlank()) {
            return false;
        }
        try {
            return Instant.parse(rec.getExpiresAt()).toEpochMilli() <= cutoffEpochMillis;
        } catch (Exception e) {
            return false;
        }
    }

    private static String buildFilename(SessionSchedule schedule, MeetingRecordingDTO rec) {
        String base = rec.getRecordingId() != null ? rec.getRecordingId() : schedule.getId();
        return "zoom-recording-" + base + ".mp4";
    }

    /**
     * Downloads recording bytes with the S2S access token. Package-visible so tests
     * can stub it (the only network call in this service). Note: buffers the whole
     * file in memory — acceptable for typical class recordings; large recordings
     * should move to a streamed upload (tracked as a follow-up).
     */
    byte[] downloadBytes(String downloadUrl, String accessToken) throws Exception {
        URL url = new URL(downloadUrl);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        connection.setConnectTimeout(10_000);
        connection.setReadTimeout(120_000);
        connection.setInstanceFollowRedirects(true);
        try (var in = connection.getInputStream()) {
            return in.readAllBytes();
        }
    }
}
