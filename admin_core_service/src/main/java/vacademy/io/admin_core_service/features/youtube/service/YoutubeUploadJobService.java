package vacademy.io.admin_core_service.features.youtube.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.admin_core_service.features.youtube.entity.InstituteYoutubeCredentials;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadDefaults;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadJob;
import vacademy.io.admin_core_service.features.youtube.repository.InstituteYoutubeCredentialsRepository;
import vacademy.io.admin_core_service.features.youtube.repository.YoutubeUploadDefaultsRepository;
import vacademy.io.admin_core_service.features.youtube.repository.YoutubeUploadJobRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.List;
import java.util.Optional;

/**
 * Owns the lifecycle of YoutubeUploadJob rows — enqueue, retry policy, and
 * the state machine transitions. The actual upload happens in
 * {@link YoutubeUploadService}; this service decides when and whether to call
 * it.
 *
 * Retry policy:
 *   - Up to {@code maxAttempts} (default 5).
 *   - Backoff schedule on transient errors: 1m → 5m → 15m → 1h → 6h.
 *   - quotaExceeded gets a 24h backoff regardless of attempt number, because
 *     YouTube quotas reset daily and shorter retries just burn the next
 *     window.
 *   - invalidGrant / forbidden auth errors short-circuit to FAILED — no
 *     amount of retrying fixes a revoked refresh token.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class YoutubeUploadJobService {

    private static final List<String> ACTIVE_STATUSES = List.of("QUEUED", "UPLOADING");
    private static final long[] BACKOFF_MILLIS = {
            60_000L,         // 1m
            5L * 60_000L,    // 5m
            15L * 60_000L,   // 15m
            60L * 60_000L,   // 1h
            6L * 60L * 60_000L  // 6h
    };
    private static final long QUOTA_BACKOFF_MILLIS = 24L * 60L * 60_000L;

    private final YoutubeUploadJobRepository jobRepository;
    private final InstituteYoutubeCredentialsRepository credentialsRepository;
    private final YoutubeUploadDefaultsRepository defaultsRepository;
    private final SessionScheduleRepository scheduleRepository;
    private final LiveSessionRepository liveSessionRepository;

    @Value("${youtube.upload.default-max-attempts:5}")
    private int defaultMaxAttempts;

    // -----------------------------------------------------------------------
    // Enqueue paths
    // -----------------------------------------------------------------------

    /**
     * Called by the BBB /recording/complete handler after the recording lands
     * in S3. No-op (silent skip) when the institute hasn't connected YouTube
     * or has auto-upload turned off — we don't want post-publish to fail just
     * because YouTube isn't configured.
     */
    @Transactional
    public Optional<YoutubeUploadJob> autoEnqueueIfEnabled(String sessionScheduleId, String recordingId,
                                                            String recordingFileId) {
        SessionSchedule schedule = scheduleRepository.findById(sessionScheduleId).orElse(null);
        if (schedule == null) {
            log.warn("[YouTube] Auto-enqueue: schedule not found id={}", sessionScheduleId);
            return Optional.empty();
        }
        LiveSession session = liveSessionRepository.findById(schedule.getSessionId()).orElse(null);
        if (session == null) {
            log.warn("[YouTube] Auto-enqueue: live session not found id={}", schedule.getSessionId());
            return Optional.empty();
        }
        String instituteId = session.getInstituteId();
        if (instituteId == null) {
            log.warn("[YouTube] Auto-enqueue: live session has no instituteId id={}", session.getId());
            return Optional.empty();
        }

        // Master feature gate. An institute that hasn't opted in (default
        // state) should be invisible to YouTube auto-upload — no rows
        // queued, no errors logged loudly. This is what makes the system
        // safe to ship globally without surprising any existing customer.
        Optional<YoutubeUploadDefaults> defaults = defaultsRepository.findById(instituteId);
        if (defaults.isEmpty() || !defaults.get().isFeatureEnabled()) {
            log.debug("[YouTube] Auto-enqueue skipped: institute={} has not opted into YouTube integration",
                    instituteId);
            return Optional.empty();
        }
        if (!defaults.get().isAutoUploadEnabled()) {
            log.debug("[YouTube] Auto-enqueue skipped: institute={} has auto-upload off", instituteId);
            return Optional.empty();
        }
        Optional<InstituteYoutubeCredentials> creds =
                credentialsRepository.findByInstituteIdAndStatus(instituteId, "ACTIVE");
        if (creds.isEmpty()) {
            log.debug("[YouTube] Auto-enqueue skipped: institute={} not connected", instituteId);
            return Optional.empty();
        }

        return Optional.of(enqueue(instituteId, sessionScheduleId, recordingId, recordingFileId, "AUTO", null, null));
    }

    /**
     * Called from the controller when a user clicks "Upload to YouTube" or
     * "Retry". Throws if the institute is not connected (vs. auto-enqueue
     * which silently skips) — the user clicked a button and deserves a clear
     * error.
     */
    @Transactional
    public YoutubeUploadJob manualEnqueue(String instituteId, String sessionScheduleId,
                                          String recordingId, String recordingFileId,
                                          String triggeredByUserId, String privacyOverride) {
        // Master feature gate. Different message from "not connected" because
        // the admin sees a different fix: turn on the toggle vs reconnect.
        YoutubeUploadDefaults defaults = defaultsRepository.findById(instituteId).orElse(null);
        if (defaults == null || !defaults.isFeatureEnabled()) {
            throw new VacademyException(
                    "YouTube integration is turned off for this institute. Enable it in Settings → YouTube Integration.");
        }
        credentialsRepository.findByInstituteIdAndStatus(instituteId, "ACTIVE")
                .orElseThrow(() -> new VacademyException(
                        "YouTube is not connected for this institute. Connect it in Settings → YouTube."));
        return enqueue(instituteId, sessionScheduleId, recordingId, recordingFileId,
                "MANUAL", triggeredByUserId, privacyOverride);
    }

    private YoutubeUploadJob enqueue(String instituteId, String sessionScheduleId, String recordingId,
                                     String recordingFileId, String triggeredVia,
                                     String triggeredByUserId, String privacyOverride) {
        // Guard against double-enqueue. The DB has a partial unique index on
        // (recordingFileId, status in QUEUED/UPLOADING) as a backstop, but
        // failing fast here keeps the error message friendly.
        if (jobRepository.existsByRecordingFileIdAndStatusIn(recordingFileId, ACTIVE_STATUSES)) {
            throw new VacademyException("An upload for this recording is already in progress.");
        }

        YoutubeUploadJob job = YoutubeUploadJob.builder()
                .instituteId(instituteId)
                .sessionScheduleId(sessionScheduleId)
                .recordingId(recordingId)
                .recordingFileId(recordingFileId)
                .status("QUEUED")
                .attempts(0)
                .maxAttempts(defaultMaxAttempts)
                .triggeredVia(triggeredVia)
                .triggeredByUserId(triggeredByUserId)
                .privacyStatus(privacyOverride)
                .build();
        return jobRepository.save(job);
    }

    // -----------------------------------------------------------------------
    // State transitions — called by the worker
    // -----------------------------------------------------------------------

    @Transactional
    public YoutubeUploadJob markStarting(String jobId) {
        YoutubeUploadJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new VacademyException("Job not found: " + jobId));
        job.setStatus("UPLOADING");
        job.setAttempts(job.getAttempts() + 1);
        job.setStartedAt(new Date());
        return jobRepository.save(job);
    }

    @Transactional
    public void markSuccess(String jobId, String videoId, String videoUrl, String title) {
        YoutubeUploadJob job = jobRepository.findById(jobId).orElseThrow();
        job.setStatus("DONE");
        job.setYoutubeVideoId(videoId);
        job.setYoutubeVideoUrl(videoUrl);
        job.setTitle(title);
        job.setFinishedAt(new Date());
        job.setLastError(null);
        job.setLastErrorCode(null);
        jobRepository.save(job);
    }

    @Transactional
    public void markFailure(String jobId, String errorCode, String errorMessage) {
        YoutubeUploadJob job = jobRepository.findById(jobId).orElseThrow();
        job.setLastError(errorMessage);
        job.setLastErrorCode(errorCode);

        if (isPermanent(errorCode)) {
            // No amount of retrying fixes a revoked token or invalid metadata.
            job.setStatus("FAILED");
            job.setFinishedAt(new Date());
            job.setNextRetryAt(null);
        } else if (job.getAttempts() >= job.getMaxAttempts()) {
            job.setStatus("FAILED");
            job.setFinishedAt(new Date());
            job.setNextRetryAt(null);
        } else {
            job.setStatus("QUEUED");
            job.setNextRetryAt(new Date(System.currentTimeMillis() + computeBackoff(job, errorCode)));
        }
        jobRepository.save(job);
    }

    @Transactional
    public YoutubeUploadJob resetForRetry(String jobId) {
        YoutubeUploadJob job = jobRepository.findById(jobId).orElseThrow();
        if ("DONE".equals(job.getStatus())) {
            throw new VacademyException("Job already completed");
        }
        if (ACTIVE_STATUSES.contains(job.getStatus())) {
            throw new VacademyException("Job is already pending");
        }
        // Manual retry clears the failure history so the operator gets a
        // fresh attempt budget — otherwise a user-triggered retry could fail
        // immediately because attempts == maxAttempts.
        job.setStatus("QUEUED");
        job.setAttempts(0);
        job.setNextRetryAt(null);
        job.setLastError(null);
        job.setLastErrorCode(null);
        job.setFinishedAt(null);
        return jobRepository.save(job);
    }

    // -----------------------------------------------------------------------
    // Policy helpers
    // -----------------------------------------------------------------------

    private boolean isPermanent(String errorCode) {
        if (errorCode == null) return false;
        return switch (errorCode) {
            // Auth: refresh token revoked — needs human action to reconnect.
            case "invalid_grant", "invalidGrant", "unauthorized", "authError",
                 "forbidden",
                 // Bad metadata / file: retry won't help.
                 "invalidVideoMetadata", "videoTitleEmpty", "invalidCategoryId",
                 "FILE_NOT_FOUND",
                 // Channel suspended / disabled.
                 "channelClosed", "youtubeSignupRequired" -> true;
            default -> false;
        };
    }

    private long computeBackoff(YoutubeUploadJob job, String errorCode) {
        if ("quotaExceeded".equals(errorCode) || "dailyLimitExceeded".equals(errorCode)) {
            return QUOTA_BACKOFF_MILLIS;
        }
        int idx = Math.min(Math.max(job.getAttempts() - 1, 0), BACKOFF_MILLIS.length - 1);
        return BACKOFF_MILLIS[idx];
    }
}
