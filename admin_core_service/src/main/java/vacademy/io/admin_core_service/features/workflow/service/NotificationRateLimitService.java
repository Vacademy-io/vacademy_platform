package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.workflow.entity.NotificationRateLimit;
import vacademy.io.admin_core_service.features.workflow.repository.NotificationRateLimitRepository;

import java.time.LocalDate;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationRateLimitService {

    private final NotificationRateLimitRepository rateLimitRepository;

    @Transactional
    public boolean checkAndIncrement(String instituteId, String channel) {
        return checkAndIncrement(instituteId, channel, 1);
    }

    @Transactional
    public boolean checkAndIncrement(String instituteId, String channel, int count) {
        // Reset expired counters first
        rateLimitRepository.resetExpiredCounters(LocalDate.now());

        Optional<NotificationRateLimit> limitOpt = rateLimitRepository.findByInstituteIdAndChannel(instituteId, channel);
        if (limitOpt.isEmpty()) {
            // No rate limit configured — allow
            return true;
        }

        NotificationRateLimit limit = limitOpt.get();
        if (limit.getDailyUsed() + count > limit.getDailyLimit()) {
            log.warn("Rate limit would be exceeded for institute {} channel {}: {} + {} > {}",
                    instituteId, channel, limit.getDailyUsed(), count, limit.getDailyLimit());
            return false;
        }

        // Increment by count
        for (int i = 0; i < count; i++) {
            int updated = rateLimitRepository.incrementUsage(limit.getId());
            if (updated == 0) {
                log.warn("Rate limit hit during bulk increment at {}/{} for institute {} channel {}",
                        i, count, instituteId, channel);
                return false;
            }
        }
        return true;
    }

    @Transactional(readOnly = true)
    public Optional<NotificationRateLimit> getLimit(String instituteId, String channel) {
        return rateLimitRepository.findByInstituteIdAndChannel(instituteId, channel);
    }
}
