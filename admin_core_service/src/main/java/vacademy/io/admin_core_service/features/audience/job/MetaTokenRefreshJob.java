package vacademy.io.admin_core_service.features.audience.job;

import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.FormWebhookConnector;
import vacademy.io.admin_core_service.features.audience.repository.FormWebhookConnectorRepository;
import vacademy.io.admin_core_service.features.audience.repository.OAuthConnectStateRepository;
import vacademy.io.admin_core_service.features.audience.service.AdPlatformWebhookService;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduled job that proactively refreshes expiring Meta OAuth tokens.
 *
 * Meta long-lived tokens expire after ~60 days.
 * This job runs daily and refreshes any token that expires within 10 days.
 * If refresh fails, the connector is marked TOKEN_EXPIRED so the admin is notified.
 *
 * Schedule: daily at 2:00 AM UTC (via cron expression in application.properties)
 */
@Component
@Slf4j
public class MetaTokenRefreshJob {

    @Autowired
    private FormWebhookConnectorRepository connectorRepository;

    @Autowired
    private AdPlatformWebhookService adPlatformWebhookService;

    @Autowired
    private OAuthConnectStateRepository oauthStateRepository;

    /**
     * Refresh Meta tokens that expire within 10 days.
     * Runs daily at 02:00 UTC. Cron: second minute hour day-of-month month day-of-week
     */
    @Scheduled(cron = "${meta.token.refresh.cron:0 0 2 * * ?}")
    @SchedulerLock(name = "MetaTokenRefreshJob_refreshTokens", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void refreshExpiringMetaTokens() {
        log.info("MetaTokenRefreshJob: starting token refresh check");

        LocalDateTime threshold = LocalDateTime.now().plusDays(10);
        List<FormWebhookConnector> expiring = connectorRepository
                .findExpiringTokenConnectors("META_LEAD_ADS", threshold);

        if (expiring.isEmpty()) {
            log.info("MetaTokenRefreshJob: no tokens expiring within 10 days");
            return;
        }

        log.info("MetaTokenRefreshJob: refreshing {} token(s)", expiring.size());
        for (FormWebhookConnector connector : expiring) {
            try {
                adPlatformWebhookService.refreshMetaToken(connector);
            } catch (Exception e) {
                log.error("MetaTokenRefreshJob: failed to refresh token for connector {}",
                        connector.getId(), e);
            }
        }
        log.info("MetaTokenRefreshJob: completed");
    }

    /**
     * Expire oauth_connect_state rows whose expiry time has passed.
     * Runs hourly. Keeps the state table small and prevents stale PENDING sessions
     * from occupying space indefinitely.
     */
    @Scheduled(cron = "0 0 * * * ?")
    @SchedulerLock(name = "MetaTokenRefreshJob_expireSessions", lockAtMostFor = "PT5M", lockAtLeastFor = "PT10S")
    @Transactional
    public void expireOldOAuthSessions() {
        int expired = oauthStateRepository.expireOldSessions(LocalDateTime.now());
        if (expired > 0) {
            log.info("MetaTokenRefreshJob: expired {} stale OAuth sessions", expired);
        }
    }
}
