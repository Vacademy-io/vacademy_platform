package vacademy.io.admin_core_service.features.youtube.worker;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadJob;
import vacademy.io.admin_core_service.features.youtube.repository.YoutubeUploadJobRepository;
import vacademy.io.admin_core_service.features.youtube.service.YoutubeUploadJobService;
import vacademy.io.admin_core_service.features.youtube.service.YoutubeUploadService;
import vacademy.io.admin_core_service.features.youtube.service.YoutubeUploadService.UploadResult;

import java.util.Date;
import java.util.List;

/**
 * Polls youtube_upload_job for due rows and pushes them through the uploader.
 *
 * Runs every {@code youtube.upload.worker.interval-ms} (default 30s). One
 * batch picks up at most {@code batch-size} jobs (default 3). Uploads are
 * serial within a batch so we don't open three simultaneous multi-GB streams
 * from S3 — quota and bandwidth limits dominate over CPU here.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class YoutubeUploadJobWorker {

    private final YoutubeUploadJobRepository jobRepository;
    private final YoutubeUploadJobService jobService;
    private final YoutubeUploadService uploadService;

    @Value("${youtube.upload.worker.batch-size:3}")
    private int batchSize;

    @Value("${youtube.upload.worker.enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${youtube.upload.worker.interval-ms:30000}",
               initialDelayString = "${youtube.upload.worker.initial-delay-ms:60000}")
    public void tick() {
        if (!enabled) return;

        List<YoutubeUploadJob> due;
        try {
            due = jobRepository.findDueJobs(new Date(), PageRequest.of(0, batchSize));
        } catch (Exception e) {
            log.error("[YouTube Worker] Failed to fetch due jobs: {}", e.getMessage());
            return;
        }
        if (due.isEmpty()) return;

        log.info("[YouTube Worker] Picked {} due job(s)", due.size());
        for (YoutubeUploadJob job : due) {
            processOne(job.getId());
        }
    }

    /**
     * Processes a single job. Each call is its own transaction (the state
     * service annotations enforce this) so a crash mid-upload doesn't leave
     * the whole batch hanging in UPLOADING.
     */
    private void processOne(String jobId) {
        YoutubeUploadJob job;
        try {
            job = jobService.markStarting(jobId);
        } catch (Exception e) {
            log.error("[YouTube Worker] Could not start job={}: {}", jobId, e.getMessage());
            return;
        }

        UploadResult result;
        try {
            result = uploadService.upload(job);
        } catch (Exception e) {
            // upload() catches everything itself, but defence-in-depth: a
            // runaway exception here would otherwise leave the job stuck in
            // UPLOADING forever.
            log.error("[YouTube Worker] Unexpected error job={}: {}", jobId, e.getMessage(), e);
            jobService.markFailure(jobId, "WORKER_ERROR", e.getMessage());
            return;
        }

        if (result.success()) {
            jobService.markSuccess(jobId, result.videoId(), result.videoUrl(), result.title());
        } else {
            jobService.markFailure(jobId, result.errorCode(), result.errorMessage());
        }
    }
}
