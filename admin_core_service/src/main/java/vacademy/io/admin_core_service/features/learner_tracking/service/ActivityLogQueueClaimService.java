package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogProcessingProjection;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Hands out disjoint batches of activity logs to whichever replica asks.
 *
 * This lives in its own bean on purpose. The select-then-mark pair has to run inside ONE
 * transaction or the row locks are dropped between the two statements and two replicas
 * can claim the same logs. If {@link ActivityLogProcessorService} called a @Transactional
 * method on itself, Spring's proxy would be bypassed and each repository call would get
 * its own transaction - reintroducing exactly the race this is meant to close.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityLogQueueClaimService {

        private final ActivityLogRepository activityLogRepository;

        /**
         * Atomically take up to {@code limit} logs and mark them in-flight.
         *
         * @param statuses       queue states eligible to be picked up
         * @param maxAttempts    skip logs that have already been tried this many times
         * @param limit          batch size
         * @param inFlightStatus status to park claimed rows under while they are worked
         * @return the claimed logs, empty if another replica got there first
         */
        @Transactional
        public List<ActivityLogProcessingProjection> claimBatch(List<String> statuses, int maxAttempts, int limit,
                        String inFlightStatus) {
                List<ActivityLogProcessingProjection> claimed = activityLogRepository
                                .claimProcessingBatch(statuses, maxAttempts, limit);

                if (claimed.isEmpty()) {
                        return List.of();
                }

                List<String> ids = claimed.stream()
                                .map(log -> log.getId())
                                .collect(Collectors.toList());

                activityLogRepository.markClaimed(ids, inFlightStatus);
                log.info("[LLM-Analytics-Claim] Claimed {} activity log(s) for this replica", ids.size());

                return claimed;
        }

        /**
         * Hand back logs stranded in-flight by a replica that died mid-batch. They return
         * as 'failed' so the attempt counter still governs how often they are retried.
         */
        @Transactional
        public int releaseStaleClaims(int staleMinutes) {
                int released = activityLogRepository.releaseStaleClaims(staleMinutes);
                if (released > 0) {
                        log.warn("[LLM-Analytics-Claim] Released {} stale in-flight activity log(s) older than {}m",
                                        released, staleMinutes);
                }
                return released;
        }
}
